/**
 * CCS-style order endpoint.
 * Looks up the test result from the server-side full case,
 * stamps orderedAt / availableAt, returns to client.
 * Does NOT reveal the result until availableAt <= simulationTime.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { getCaseServerSide } from "./_supabase.js";
import { normaliseTestName, inferTurnaround } from "../src/utils/normaliseTestName.js";

const ai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.DEEPSEEK_API_KEY,
});

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  if (!body.caseId || typeof body.caseId !== "string") throw new Error("Missing: caseId");
  if (!["lab", "imaging"].includes(body.testType))      throw new Error("Invalid testType");
  if (!body.testName || typeof body.testName !== "string") throw new Error("Missing: testName");
  if (typeof body.currentSimTime !== "number")          throw new Error("Missing: currentSimTime");
  return {
    caseId:         body.caseId         as string,
    testType:       body.testType       as "lab" | "imaging",
    testName:       body.testName       as string,
    currentSimTime: body.currentSimTime as number,
    priority:       (body.priority === "routine" ? "routine" : "stat") as "stat" | "routine",
  };
}

async function generateLabResult(testName: string, fullCase: any): Promise<{ value: string; unit: string; normalRange: string; status: "normal" | "abnormal" | "critical" }> {
  const context = `Diagnosis: ${fullCase.correctDiagnosis}. Chief complaint: ${fullCase.chiefComplaint}. Age: ${fullCase.age}, ${fullCase.gender}. Vitals: HR ${fullCase.vitals?.heartRate}, BP ${fullCase.vitals?.bloodPressure}, SpO2 ${fullCase.vitals?.oxygenSaturation}%.`;
  const resp = await ai.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 80,
    temperature: 0.2,
    messages: [
      { role: "system", content: 'You are a clinical simulator. Return ONLY valid JSON: {"value":"...","unit":"...","normalRange":"...","status":"normal"|"abnormal"|"critical"}. No markdown.' },
      { role: "user", content: `${context}\n\nReturn a realistic ${testName} result for this patient.` },
    ],
  });
  const raw = resp.choices[0]?.message?.content?.trim() ?? "{}";
  const parsed = JSON.parse(raw);
  return {
    value:       String(parsed.value       ?? "—"),
    unit:        String(parsed.unit        ?? ""),
    normalRange: String(parsed.normalRange ?? ""),
    status:      ["normal", "abnormal", "critical"].includes(parsed.status) ? parsed.status : "normal",
  };
}

async function generateImagingResult(testName: string, fullCase: any): Promise<{ findings: string; impression: string }> {
  const context = `Diagnosis: ${fullCase.correctDiagnosis}. Chief complaint: ${fullCase.chiefComplaint}. Age: ${fullCase.age}, ${fullCase.gender}. HPI: ${(fullCase.historyOfPresentIllness ?? "").slice(0, 200)}.`;
  const resp = await ai.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: 200,
    temperature: 0.3,
    messages: [
      { role: "system", content: 'You are a radiologist. Return ONLY valid JSON: {"findings":"...","impression":"..."}. Findings: 2-4 sentences of realistic report language. Impression: 1 concise sentence. No markdown.' },
      { role: "user", content: `${context}\n\nWrite a radiology report for: ${testName}` },
    ],
  });
  const raw = resp.choices[0]?.message?.content?.trim() ?? "{}";
  const parsed = JSON.parse(raw);
  return {
    findings:   String(parsed.findings   ?? "Examination performed. No acute abnormality identified."),
    impression: String(parsed.impression ?? "No acute findings."),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { caseId, testType, testName: rawName, currentSimTime, priority } = validateRequest(req.body);

    // Normalise: "Troponin I" → "Troponin", "EKG" → "ECG", "CT Brain" → "CT Head", etc.
    const testName = normaliseTestName(rawName);

    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found. Please start a new case." });
    }

    // Look up timing from the AI-declared catalog first; fall back to keyword inference.
    const catalog: any[] = testType === "lab"
      ? (fullCase.availableTests?.labs || [])
      : (fullCase.availableTests?.imaging || []);

    const catalogEntry = catalog.find((t: any) => {
      const n = typeof t === "string" ? t : t.name;
      return (
        normaliseTestName(n).toLowerCase() === testName.toLowerCase() ||
        n.toLowerCase() === rawName.toLowerCase()
      );
    });

    const delays =
      catalogEntry && typeof catalogEntry === "object" && catalogEntry.stat != null
        ? { stat: catalogEntry.stat, routine: catalogEntry.routine }
        : inferTurnaround(testName, testType);

    const orderedAt   = currentSimTime;
    const availableAt = currentSimTime + delays[priority];

    let result: any;
    if (testType === "lab") {
      const match = (fullCase.labs || []).find(
        (l: any) => normaliseTestName(l.name) === testName
      ) || (fullCase.labs || []).find(
        (l: any) => l.name.toLowerCase().includes(testName.toLowerCase()) ||
                    testName.toLowerCase().includes(l.name.toLowerCase())
      );
      if (match) {
        result = { ...match, orderedAt, availableAt };
      } else {
        const generated = await generateLabResult(rawName, fullCase);
        result = { name: rawName, ...generated, orderedAt, availableAt };
      }
    } else {
      const match = (fullCase.imaging || []).find(
        (i: any) => normaliseTestName(i.type) === testName
      ) || (fullCase.imaging || []).find(
        (i: any) => i.type.toLowerCase().includes(testName.toLowerCase()) ||
                    testName.toLowerCase().includes(i.type.toLowerCase())
      );
      if (match) {
        result = { ...match, orderedAt, availableAt };
      } else {
        const generated = await generateImagingResult(rawName, fullCase);
        result = { type: rawName, ...generated, orderedAt, availableAt };
      }
    }

    const action = {
      id:          `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp:   currentSimTime,
      type:        "order",
      description: `Ordered ${testName}${rawName !== testName ? ` (${rawName})` : ""} (${priority.toUpperCase()})`,
      result:      `Results expected at T+${availableAt} min`,
    };

    res.json({ success: true, testResult: result, action, message: `${testName} ordered. Results available at T+${availableAt} min.` });
  } catch (err: any) {
    console.error("order-test error:", err);
    res.status(500).json({ error: err.message || "Failed to order test." });
  }
}
