import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";
import { MEDICAL_CASE_SCHEMA } from "./src/lib/schema";
import { MedicalCase } from "./src/types";

// ── In-memory case store for dev mode ─────────────────────────────────────────
// Mirrors api/_supabase.ts fallback so order-test / end-case work locally.
const casesStore = new Map<string, any>();

// ── Shared helpers ────────────────────────────────────────────────────────────

/** Trim the MedicalCase payload to avoid unbounded growth in request size */
function trimCase(mc: any) {
  return {
    ...mc,
    clinicalActions: (mc.clinicalActions || []).slice(-10),
    communicationLog: (mc.communicationLog || []).slice(-10),
  };
}

function requireString(val: any, field: string, maxLen = 5000): string {
  if (typeof val !== "string" || val.trim() === "") {
    throw new Error(`Missing or invalid field: ${field} (must be a non-empty string).`);
  }
  if (val.length > maxLen) {
    throw new Error(`${field} too long (max ${maxLen} characters).`);
  }
  return val.trim();
}

function requireObject(val: any, field: string): object {
  if (!val || typeof val !== "object" || Array.isArray(val)) {
    throw new Error(`Missing or invalid field: ${field} (must be an object).`);
  }
  return val;
}

// ── Server bootstrap ──────────────────────────────────────────────────────────

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "2mb" }));

  const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: "https://api.deepseek.com",
  });

  // ── POST /api/generate-case ─────────────────────────────────────────────────
  app.post("/api/generate-case", async (req, res) => {
    try {
      const { category, difficulty, history, environment } = req.body;

      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
        return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in Secrets." });
      }

      const allowedDifficulties = ["intern", "resident", "attending"];
      if (difficulty && !allowedDifficulties.includes(difficulty)) {
        return res.status(400).json({ error: "Invalid difficulty value." });
      }

      const envContext =
        environment === "rural"
          ? "SETTING: Rural Critical Access Hospital. Limited resources. CT takes 60 mins. Specialized labs (Troponin, Lactate) available but slow. No MRI."
          : environment === "prehospital"
          ? "SETTING: Pre-hospital (Ambulance). Only portable monitor and BASIC meds. No labs or imaging available in the field."
          : "SETTING: Level 1 Tertiary Trauma Center. All resources available.";

      const historyContext =
        history && history.length > 0
          ? `User's Recent Case History: ${history
              .map((h: any) => `${h.category} (${h.score}%)`)
              .join(", ")}. Avoid repeating the exact clinical presentation from these cases.`
          : "";

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a high-fidelity clinical simulation engine. Generate a complex, acute medical case.
Difficulty Settings:
- Intern: Clear clues, classic presentations (e.g. STEMI, Sepsis).
- Resident: Mixed clues, moderate complexity (e.g. PE vs Pneumonia, DKA).
- Attending: Subtle clues, rare conditions or diagnostic dilemmas (e.g. Thyroid Storm, Serotonin Syndrome, occult Hemorrhage).

${envContext}
${historyContext}

CRITICAL REQUIREMENTS:
- You MUST generate a unique "id" field (e.g. "case-a1b2c3"). Do NOT omit it.
- Initialize simulationTime at 0.
- Initialize currentLocation as ${environment === "prehospital" ? '"Ambulance Rescue 1"' : '"Emergency Room (ER) Bay 1"'}.
- Initialize communicationLog, medications, and activeAlarms as empty arrays.
- Initialize physiologicalTrend as 'stable' or 'declining' based on acuity.
- ALL labs and imaging should NOT have orderedAt or availableAt yet.
- For any IV fluid medications, set isIVFluid: true and volumeML to the appropriate volume in mL.
- Set patientOutcome to "alive".
- Include correctDiagnosis, explanation, and underlyingPathology in the response.
- Include availableTests with labs[] and imaging[] arrays listing orderable tests.
- Include initialAppearance (vivid 1-sentence bedside impression).
Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`,
          },
          {
            role: "user",
            content: `Generate a realistic ${difficulty || "resident"} level case in the category of ${category || "any"}.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");

      const fullCase = JSON.parse(content);
      // Fallback id if AI omits it
      if (!fullCase.id) {
        fullCase.id = `case-${Math.random().toString(36).slice(2, 9)}`;
      }

      // ── Store full case server-side (in-memory for dev) ──────────────────
      casesStore.set(fullCase.id, fullCase);

      // ── Strip answer key before sending to client (CCS design) ───────────
      const { correctDiagnosis, explanation, underlyingPathology, ...clientCase } = fullCase;

      // Clear lab/imaging results — user must ORDER them
      clientCase.labs = [];
      clientCase.imaging = [];

      // Physical exam starts locked
      if (fullCase.physicalExam) {
        clientCase.physicalExam = Object.fromEntries(
          Object.keys(fullCase.physicalExam).map((k) => [k, "Not yet examined"])
        );
      }

      res.json(clientCase);
    } catch (error: any) {
      console.error("DeepSeek Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate case" });
    }
  });

  // ── POST /api/perform-intervention ─────────────────────────────────────────
  app.post("/api/perform-intervention", async (req, res) => {
    try {
      const interventionRaw = req.body?.intervention;
      const medicalCase = req.body?.medicalCase;
      const waitTimeRaw = req.body?.waitTime;

      if (typeof interventionRaw !== "string") {
        return res.status(400).json({ error: "Missing or invalid field: intervention." });
      }
      requireObject(medicalCase, "medicalCase");
      const waitTime = waitTimeRaw !== undefined ? Number(waitTimeRaw) : 5;
      if (isNaN(waitTime) || waitTime < 0 || waitTime > 1440) {
        return res.status(400).json({ error: "Invalid waitTime." });
      }

      const newSimTime = (medicalCase.simulationTime || 0) + waitTime;

      // Pull server-side pathology context for realistic evolution
      const fullCase = casesStore.get(medicalCase.id) || null;
      const pathologyCtx = fullCase
        ? `HIDDEN PATHOLOGY (use ONLY to drive realistic evolution — NEVER reveal to user):
Correct Diagnosis: ${fullCase.correctDiagnosis}
Underlying Pathology: ${fullCase.underlyingPathology || "not specified"}
Explanation: ${fullCase.explanation || ""}`
        : "No server-side context available — evolve realistically based on current vitals.";

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a CCS clinical simulator. Advance the patient state.

${pathologyCtx}

RULES:
1. Set simulationTime = ${newSimTime}.
2. Evolve vitals realistically based on the hidden pathology + interventions given.
   - Correct treatment → improving trend
   - No/wrong treatment → worsening; untreated sepsis/shock WILL deteriorate
3. If intervention is a medication, add to medications[] (with timestamp ${newSimTime}).
   IV fluids → isIVFluid:true, volumeML:[appropriate].
4. Update activeAlarms based on current vitals (e.g. "Hypotension", "Tachycardia").
5. Update physiologicalTrend: improving | stable | declining | critical.
6. If "Transfer to X", update currentLocation.
7. Append one entry to clinicalActions (timestamp: ${newSimTime}).
8. patientOutcome:
   - "deceased" if HR<20 or HR>200 or SBP<50 or SpO2<60 or temp<32 or temp>42
   - "critical_deterioration" if trend is 'critical' and vitals worsening
   - otherwise "alive"
9. DO NOT modify labs or imaging arrays — those are managed separately.
10. DO NOT include correctDiagnosis or explanation in the response.

Return the ENTIRE updated MedicalCase JSON. Schema: ${MEDICAL_CASE_SCHEMA}`,
          },
          {
            role: "user",
            content: `Current state: ${JSON.stringify(trimCase(medicalCase))}
${interventionRaw ? `Intervention: ${interventionRaw}` : "Time advancement only — no active intervention."}
Time advances by ${waitTime} min (${medicalCase.simulationTime} → ${newSimTime}).`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");

      const updatedCase = JSON.parse(content);
      if (!updatedCase.vitals) {
        throw new Error("AI returned an incomplete medical case object.");
      }

      // Safety: preserve id & availableTests, merge ordered tests back
      updatedCase.id = medicalCase.id;
      updatedCase.availableTests = medicalCase.availableTests || updatedCase.availableTests;
      updatedCase.labs = medicalCase.labs || [];
      updatedCase.imaging = medicalCase.imaging || [];

      // Update the server-side full case
      if (fullCase) {
        Object.assign(fullCase, {
          vitals: updatedCase.vitals,
          physiologicalTrend: updatedCase.physiologicalTrend,
          currentLocation: updatedCase.currentLocation,
          simulationTime: updatedCase.simulationTime,
          activeAlarms: updatedCase.activeAlarms,
          medications: updatedCase.medications,
          clinicalActions: updatedCase.clinicalActions,
          patientOutcome: updatedCase.patientOutcome,
          currentCondition: updatedCase.currentCondition,
        });
        casesStore.set(medicalCase.id, fullCase);
      }

      // Strip server-only fields before sending to client
      const { correctDiagnosis, explanation, underlyingPathology, ...clientCase } = updatedCase;
      res.json(clientCase);
    } catch (error: any) {
      console.error("Intervention Error:", error);
      res.status(500).json({ error: "Simulator failed to process intervention." });
    }
  });

  // ── POST /api/order-test ────────────────────────────────────────────────────
  app.post("/api/order-test", async (req, res) => {
    try {
      const { caseId, testType, testName: rawName, currentSimTime, priority: rawPriority } = req.body ?? {};

      if (!caseId || typeof caseId !== "string") return res.status(400).json({ error: "Missing: caseId" });
      if (!["lab", "imaging"].includes(testType)) return res.status(400).json({ error: "Invalid testType" });
      if (!rawName || typeof rawName !== "string") return res.status(400).json({ error: "Missing: testName" });
      if (typeof currentSimTime !== "number") return res.status(400).json({ error: "Missing: currentSimTime" });

      const priority = rawPriority === "routine" ? "routine" : "stat";

      // Dynamic import of normalise utility
      const { normaliseTestName, TURNAROUND } = await import("./src/utils/normaliseTestName");
      const testName = normaliseTestName(rawName);

      const delays = TURNAROUND[testName];
      if (!delays) {
        return res.status(400).json({
          error: `Unknown test "${rawName}". Available: ${Object.keys(TURNAROUND).join(", ")}`,
        });
      }

      const orderedAt = currentSimTime;
      const availableAt = currentSimTime + delays[priority];

      const fullCase = casesStore.get(caseId) || null;
      if (!fullCase) {
        return res.status(404).json({ error: "Case not found. Please start a new case." });
      }

      let result: any;
      if (testType === "lab") {
        const match = (fullCase.labs || []).find(
          (l: any) => normaliseTestName(l.name) === testName
        );
        result = match
          ? { ...match, orderedAt, availableAt }
          : { name: rawName, value: "Pending", unit: "", normalRange: "", status: "normal", orderedAt, availableAt };
      } else {
        const match = (fullCase.imaging || []).find(
          (i: any) => normaliseTestName(i.type) === testName
        );
        result = match
          ? { ...match, orderedAt, availableAt }
          : { type: rawName, findings: "Pending read", impression: "Pending", orderedAt, availableAt };
      }

      const action = {
        id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: currentSimTime,
        type: "order",
        description: `Ordered ${testName}${rawName !== testName ? ` (${rawName})` : ""} (${priority.toUpperCase()})`,
        result: `Results expected at T+${availableAt} min`,
      };

      res.json({ success: true, testResult: result, action, message: `${testName} ordered. Results available at T+${availableAt} min.` });
    } catch (err: any) {
      console.error("order-test error:", err);
      res.status(500).json({ error: err.message || "Failed to order test." });
    }
  });

  // ── POST /api/examine-system ────────────────────────────────────────────────
  app.post("/api/examine-system", async (req, res) => {
    try {
      const { caseId, system } = req.body ?? {};
      const SYSTEM_KEYS = ['heent', 'cardiac', 'respiratory', 'abdomen', 'extremities', 'neurological'];

      if (!caseId || typeof caseId !== "string") return res.status(400).json({ error: "Missing: caseId" });
      if (!system || !SYSTEM_KEYS.includes(system)) return res.status(400).json({ error: `Invalid system. Must be one of: ${SYSTEM_KEYS.join(", ")}` });

      const fullCase = casesStore.get(caseId) || null;
      if (!fullCase) return res.status(404).json({ error: "Case not found. Please start a new case." });

      const finding = fullCase.physicalExam?.[system];
      if (!finding || finding === "Not yet examined") {
        return res.status(404).json({ error: `No finding for system "${system}" in this case.` });
      }

      res.json({ system, finding });
    } catch (err: any) {
      console.error("examine-system error:", err);
      res.status(500).json({ error: err.message || "Failed to retrieve examination finding." });
    }
  });

  // ── POST /api/end-case ──────────────────────────────────────────────────────
  app.post("/api/end-case", async (req, res) => {
    try {
      const { caseId, medicalCase, userNotes } = req.body ?? {};
      if (!caseId || typeof caseId !== "string") return res.status(400).json({ error: "Missing: caseId" });
      if (!medicalCase || typeof medicalCase !== "object") return res.status(400).json({ error: "Missing: medicalCase" });

      const fullCase = casesStore.get(caseId) || null;
      if (!fullCase) return res.status(404).json({ error: "Case not found or already scored." });

      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_"))
        return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });

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
            content: `You are a USMLE Step 3 CCS examiner. Score management quality.

ANSWER KEY:
  Correct Diagnosis: ${fullCase.correctDiagnosis}
  Explanation: ${fullCase.explanation || ""}

SCORING (100 pts total):
  initialManagement (0-25), diagnosticWorkup (0-25), therapeuticInterventions (0-30), patientOutcome (0-20).
  Subtract efficiency penalties if warranted.

Return JSON ONLY:
{
  "score": number,
  "breakdown": { "initialManagement": number, "diagnosticWorkup": number, "therapeuticInterventions": number, "patientOutcome": number, "efficiencyPenalty": number },
  "feedback": "3-4 sentence narrative",
  "correctDiagnosis": "${fullCase.correctDiagnosis}",
  "explanation": "brief teaching point",
  "keyActions": ["description", ...],
  "criticalMissed": ["missed action", ...],
  "clinicalPearl": "one memorable teaching point"
}`,
          },
          {
            role: "user",
            content: `CASE: ${medicalCase.chiefComplaint} | ${medicalCase.age}y ${medicalCase.gender}
LABS ORDERED: ${labsOrdered}
IMAGING ORDERED: ${imagingOrdered}
ACTIONS:\n${actionLog}
MEDICATIONS:\n${medLog}
FINAL STATE: T+${medicalCase.simulationTime} min | Outcome: ${medicalCase.patientOutcome || "alive"} | Trend: ${medicalCase.physiologicalTrend}
USER NOTES: ${userNotes || "none"}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = aiRes.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI evaluator");

      const evaluation = JSON.parse(content);

      // Clean up active case
      casesStore.delete(caseId);

      res.json({ ...evaluation, caseId, totalSimulationTime: medicalCase.simulationTime });
    } catch (err: any) {
      console.error("end-case error:", err);
      res.status(500).json({ error: err.message || "Failed to score case." });
    }
  });

  // ── POST /api/staff-call ────────────────────────────────────────────────────
  app.post("/api/staff-call", async (req, res) => {
    try {
      const target = requireString(req.body?.target, "target");
      const message = requireString(req.body?.message, "message", 1000);
      const medicalCase = requireObject(req.body?.medicalCase, "medicalCase");

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a healthcare professional (${target}).
Respond to the physician's message realistically based on the patient's current state.
Keep it clinical and concise.
Return a JSON object: { "reply": string, "updatedCase": MedicalCase }
Add the exchange to communicationLog in updatedCase. Preserve the original id field.
Schema: ${MEDICAL_CASE_SCHEMA}`,
          },
          {
            role: "user",
            content: `Patient state: ${JSON.stringify(trimCase(medicalCase))}.
Communication target: ${target}.
Message: ${message}.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");

      const parsed = JSON.parse(content);
      // Preserve id
      if (parsed.updatedCase && !parsed.updatedCase.id) {
        parsed.updatedCase.id = (medicalCase as any).id;
      }

      res.json(parsed);
    } catch (error: any) {
      console.error("Call Error:", error);
      res.status(500).json({ error: "Communication line disrupted." });
    }
  });

  // ── POST /api/evaluate-diagnosis ────────────────────────────────────────────
  app.post("/api/evaluate-diagnosis", async (req, res) => {
    try {
      const userDiagnosis = requireString(req.body?.userDiagnosis, "userDiagnosis", 2000);
      const medicalCase = requireObject(req.body?.medicalCase, "medicalCase") as any;

      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
        return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });
      }

      const trimmedForEval = {
        patientName: medicalCase.patientName,
        age: medicalCase.age,
        gender: medicalCase.gender,
        chiefComplaint: medicalCase.chiefComplaint,
        historyOfPresentIllness: medicalCase.historyOfPresentIllness,
        vitals: medicalCase.vitals,
        physicalExam: medicalCase.physicalExam,
        labs: medicalCase.labs,
        imaging: medicalCase.imaging,
        correctDiagnosis: medicalCase.correctDiagnosis,
        explanation: medicalCase.explanation,
        simulationTime: medicalCase.simulationTime,
        medications: medicalCase.medications,
        clinicalActions: (medicalCase.clinicalActions || []).slice(-10),
      };

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a medical examiner. Evaluate the user's diagnostic accuracy. " +
              "Consider: accuracy of diagnosis, appropriateness of workup ordered, speed of decision-making, and treatment choices. " +
              'Respond ONLY with a JSON object: { "score": number (0-100), "feedback": string }',
          },
          {
            role: "user",
            content: `Evaluate diagnosis: "${userDiagnosis}" for the following case: ${JSON.stringify(trimmedForEval)}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");

      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("DeepSeek Evaluation Error:", error);
      res.status(500).json({ error: error.message || "Failed to evaluate diagnosis" });
    }
  });

  // ── POST /api/consult ───────────────────────────────────────────────────────
  app.post("/api/consult", async (req, res) => {
    try {
      const medicalCase = requireObject(req.body?.medicalCase, "medicalCase") as any;

      const trimmedCase = {
        patientName: medicalCase.patientName,
        age: medicalCase.age,
        gender: medicalCase.gender,
        chiefComplaint: medicalCase.chiefComplaint,
        historyOfPresentIllness: medicalCase.historyOfPresentIllness,
        pastMedicalHistory: medicalCase.pastMedicalHistory,
        vitals: medicalCase.vitals,
        physicalExam: medicalCase.physicalExam,
        physiologicalTrend: medicalCase.physiologicalTrend,
        activeAlarms: medicalCase.activeAlarms,
        labs: medicalCase.labs,
        imaging: medicalCase.imaging,
        medications: medicalCase.medications,
        simulationTime: medicalCase.simulationTime,
        currentLocation: medicalCase.currentLocation,
        difficulty: medicalCase.difficulty,
        category: medicalCase.category,
        clinicalActions: (medicalCase.clinicalActions || []).slice(-5),
        communicationLog: (medicalCase.communicationLog || []).slice(-5),
      };

      const consultPrompt = `Analyze the following medical case and provide consultant-level advice.
State the current most likely differential diagnosis, the underlying clinical reasoning, and suggest the top 3 immediate next steps.
Return ONLY a JSON object with this exact shape:
{ "advice": string, "reasoning": string, "recommendedActions": string[] }

Case: ${JSON.stringify(trimmedCase)}`;

      const geminiAvailable =
        process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("MY_");

      if (geminiAvailable) {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash-lite",
          contents: consultPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                advice: { type: Type.STRING },
                reasoning: { type: Type.STRING },
                recommendedActions: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
              required: ["advice", "reasoning", "recommendedActions"],
            },
          },
        });
        const text = response.text;
        if (!text) throw new Error("Consultant was unable to provide advice.");
        return res.json(JSON.parse(text));
      }

      // DeepSeek fallback
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
        return res.status(500).json({ error: "No AI API key is configured. Set DEEPSEEK_API_KEY or GEMINI_API_KEY." });
      }

      const dsResponse = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a senior specialist consultant. Analyze the medical case provided and return ONLY a valid JSON object with keys: advice (string), reasoning (string), recommendedActions (array of strings).",
          },
          { role: "user", content: consultPrompt },
        ],
        response_format: { type: "json_object" },
      });

      const dsContent = dsResponse.choices[0].message.content;
      if (!dsContent) throw new Error("Consultant was unable to provide advice.");

      res.json(JSON.parse(dsContent));
    } catch (error: any) {
      console.error("Consult Error:", error);
      res.status(500).json({ error: error.message || "Consultant is currently unavailable." });
    }
  });

  // ── Global API error handler (must be BEFORE vite/static) ──────────────────
  app.use("/api", (err: any, _req: any, res: any, _next: any) => {
    console.error("API error:", err);
    res.status(500).json({ error: "API Internal Error", details: err.message });
  });

  // ── Vite / static serving ───────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
