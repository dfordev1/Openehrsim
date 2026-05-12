/**
 * CCS case-completion & management-based scoring endpoint.
 *
 * Retrieves the hidden correctDiagnosis from Supabase,
 * scores the user's management, persists results, and deletes the active case.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { getCaseServerSide, deleteCaseServerSide, getServerSupabase } from "./_supabase.js";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  if (!body.caseId || typeof body.caseId !== "string") throw new Error("Missing: caseId");
  if (!body.medicalCase || typeof body.medicalCase !== "object") throw new Error("Missing: medicalCase");
  return {
    caseId:      body.caseId      as string,
    medicalCase: body.medicalCase as any,
    userNotes:   body.userNotes   as string | undefined,
  };
}

function trimCase(mc: any) {
  return {
    ...mc,
    clinicalActions:  (mc.clinicalActions  || []).slice(-20),
    communicationLog: (mc.communicationLog || []).slice(-10),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { caseId, medicalCase, userNotes } = validateRequest(req.body);

    // ── Fetch answer key ──────────────────────────────────────────────────────
    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found or already scored." });
    }

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_"))
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });

    const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });

    const actionLog = (medicalCase.clinicalActions || [])
      .map((a: any) => `T+${a.timestamp}: [${a.type}] ${a.description}`)
      .join("\n") || "No actions recorded.";

    const medLog = (medicalCase.medications || [])
      .map((m: any) => `T+${m.timestamp}: ${m.name} ${m.dose} ${m.route}`)
      .join("\n") || "No medications administered.";

    const labsOrdered = (medicalCase.labs || [])
      .map((l: any) => `${l.name} (ordered T+${l.orderedAt ?? "?"})`)
      .join(", ") || "None";

    const imagingOrdered = (medicalCase.imaging || [])
      .map((i: any) => `${i.type} (ordered T+${i.orderedAt ?? "?"})`)
      .join(", ") || "None";

    const aiRes = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a USMLE Step 3 CCS examiner. Score management quality — NOT just diagnosis.

ANSWER KEY:
  Correct Diagnosis: ${fullCase.correctDiagnosis}
  Explanation: ${fullCase.explanation || ""}

SCORING (100 pts total):
  initialManagement (0-25):
    - Did they place appropriate initial orders (vitals, O2, IV access, basic workup)?
    - Did they recognise acuity and act quickly?
  diagnosticWorkup (0-25):
    - Ordered the right tests at the right time?
    - Avoided unnecessary / expensive / harmful tests?
  therapeuticInterventions (0-30):
    - Correct treatment for the underlying condition?
    - Critical interventions (antibiotics <1h for sepsis, fluids for shock, PCI for STEMI) done on time?
    - Appropriate doses / routes?
  patientOutcome (0-20):
    - alive with improving trend: 20
    - alive stable:               12
    - critical deterioration:      5
    - deceased:                    0

EFFICIENCY PENALTIES (subtract from total):
  - >5 unnecessary tests:   -10
  - Key intervention >30 min late: -10

Return JSON ONLY:
{
  "score": number,
  "breakdown": {
    "initialManagement": number,
    "diagnosticWorkup": number,
    "therapeuticInterventions": number,
    "patientOutcome": number,
    "efficiencyPenalty": number
  },
  "feedback": "3-4 sentence narrative of overall performance",
  "correctDiagnosis": "${fullCase.correctDiagnosis}",
  "explanation": "brief teaching point",
  "keyActions": ["✓ or ✗ + description", ...],
  "criticalMissed": ["missed or delayed critical action", ...],
  "clinicalPearl": "one memorable teaching point from this case"
}`,
        },
        {
          role: "user",
          content: `CASE: ${medicalCase.chiefComplaint} | ${medicalCase.age}y ${medicalCase.gender}
INITIAL VITALS: HR ${medicalCase.vitals?.heartRate}, BP ${medicalCase.vitals?.bloodPressure}, RR ${medicalCase.vitals?.respiratoryRate}, SpO2 ${medicalCase.vitals?.oxygenSaturation}%, Temp ${medicalCase.vitals?.temperature}°C

LABS ORDERED: ${labsOrdered}
IMAGING ORDERED: ${imagingOrdered}

ACTIONS:
${actionLog}

MEDICATIONS:
${medLog}

FINAL STATE: T+${medicalCase.simulationTime} min | Outcome: ${medicalCase.patientOutcome || "alive"} | Trend: ${medicalCase.physiologicalTrend}
FINAL VITALS: HR ${medicalCase.vitals?.heartRate}, BP ${medicalCase.vitals?.bloodPressure}, SpO2 ${medicalCase.vitals?.oxygenSaturation}%

USER NOTES: ${userNotes || "none"}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = aiRes.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI evaluator");

    const evaluation = JSON.parse(content);

    // ── Persist result to simulation_results table ────────────────────────────
    const db = getServerSupabase();
    if (db) {
      const { error: saveErr } = await (db as any).from("simulation_results").insert([{
        case_id:              caseId,
        patient_name:         medicalCase.patientName,
        age:                  medicalCase.age,
        category:             medicalCase.category,
        difficulty:           medicalCase.difficulty,
        user_diagnosis:       userNotes || null,
        correct_diagnosis:    fullCase.correctDiagnosis,
        score:                evaluation.score,
        feedback:             evaluation.feedback,
        simulation_time:      medicalCase.simulationTime,
        clinical_actions:     medicalCase.clinicalActions,
        medications:          medicalCase.medications,
        management_breakdown: evaluation.breakdown,
        key_actions:          evaluation.keyActions,
        clinical_pearl:       evaluation.clinicalPearl,
      }]);
      if (saveErr) console.warn("Could not save result:", saveErr.message);
    }

    // ── Clean up active case ──────────────────────────────────────────────────
    await deleteCaseServerSide(caseId);

    res.json({
      ...evaluation,
      caseId,
      totalSimulationTime: medicalCase.simulationTime,
    });
  } catch (err: any) {
    console.error("end-case error:", err);
    res.status(500).json({ error: err.message || "Failed to score case." });
  }
}
