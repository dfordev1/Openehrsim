import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";
import { MEDICAL_CASE_SCHEMA } from "./src/lib/schema";
import { MedicalCase } from "./src/types";

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

      const parsed = JSON.parse(content);
      // Fallback id if AI omits it
      if (!parsed.id) {
        parsed.id = `case-${Math.random().toString(36).slice(2, 9)}`;
      }

      res.json(parsed);
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

      requireString(interventionRaw, "intervention");
      requireObject(medicalCase, "medicalCase");
      const waitTime = waitTimeRaw !== undefined ? Number(waitTimeRaw) : 5;
      if (isNaN(waitTime) || waitTime < 0 || waitTime > 1440) {
        return res.status(400).json({ error: "Invalid waitTime." });
      }

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a clinical simulator. Analyze the intervention/wait-time.
Update the MedicalCase state based on the following rules:
1. Advance simulationTime by ${waitTime} minutes.
2. Update physiologicalTrend based on interventions (Fluids/Vasopressors move it towards 'improving').
3. Update vitals realistically. If trend is 'declining', vitals should drift towards disaster (HR up, BP down, etc.).
4. If action is "Transfer to [Dept]", update currentLocation accordingly.
5. If intervention involves medication (e.g. "Administer [Drug] [Dose]"), add to 'medications' array.
   - If the medication is an IV fluid (NS, LR, Albumin, colloids, crystalloids), set isIVFluid: true and volumeML to the appropriate volume in mL.
6. If vitals are critical, add descriptive strings to 'activeAlarms' (e.g. "Low SpO2", "Bradycardia").
7. If an intervention was "Order lab: [name]" or "Order imaging: [type]", handle orderedAt/availableAt.
8. Lab "clinicalNote" should include relevant path/tech comments.
9. Imaging 'findings' and 'impression' MUST be professional radiologic reports.
10. If the patient is transferred, update 'currentLocation'.
11. Add a log entry to clinicalActions.
12. PATIENT OUTCOME: Set patientOutcome:
    - "deceased" if HR < 20 or HR > 200 or SBP < 50 or SpO2 < 60 or temp < 32 or temp > 42.
    - "critical_deterioration" if physiologicalTrend is 'critical'.
    - Otherwise "alive".

CRITICAL: Return the ENTIRE MedicalCase object. Preserve the original id field.
Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`,
          },
          {
            role: "user",
            content: `Current Case State: ${JSON.stringify(trimCase(medicalCase))}.
Action Taken: ${interventionRaw}.
Wait Time: ${waitTime} min.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");

      const updatedCase = JSON.parse(content);
      if (!updatedCase.vitals || !updatedCase.labs || !updatedCase.imaging) {
        throw new Error("AI returned an incomplete medical case object.");
      }

      // Preserve id
      if (!updatedCase.id && medicalCase.id) updatedCase.id = medicalCase.id;

      res.json(updatedCase);
    } catch (error: any) {
      console.error("Intervention Error:", error);
      res.status(500).json({ error: "Simulator failed to process intervention." });
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

      // Only send clinically relevant fields for evaluation
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

      if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("MY_")) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured in Secrets." });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

      // Only send relevant clinical info for consultation
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

      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash-lite",
        contents: `Analyze the following medical case and provide consultant-level advice.
State the current most likely differential diagnosis, reasoning, and suggest the top 3 immediate next steps.

Case: ${JSON.stringify(trimmedCase)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              advice: {
                type: Type.STRING,
                description: "A high-level clinical summary and recommendation.",
              },
              reasoning: {
                type: Type.STRING,
                description: "The underlying pathophysiological or clinical reasoning.",
              },
              recommendedActions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "A list of urgent next steps or orders.",
              },
            },
            required: ["advice", "reasoning", "recommendedActions"],
          },
        },
      });

      const text = response.text;
      if (!text) throw new Error("Consultant was unable to provide advice.");

      res.json(JSON.parse(text));
    } catch (error: any) {
      console.error("Consult Error:", error);
      res.status(500).json({ error: error.message || "Consultant is currently unavailable." });
    }
  });

  // ── Global API error handler ────────────────────────────────────────────────
  app.use("/api", (err: any, req: any, res: any, next: any) => {
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
