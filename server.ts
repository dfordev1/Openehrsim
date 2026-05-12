import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Security: limit request body size to prevent abuse
  app.use(express.json({ limit: "1mb" }));

  // Security headers
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    next();
  });

  const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY!;

  const openai = new OpenAI({
    apiKey: DEEPSEEK_KEY,
    baseURL: "https://api.deepseek.com",
  });

  const MEDICAL_CASE_SCHEMA = `
    interface MedicalCase {
      id: string;
      patientName: string;
      age: number;
      gender: string;
      chiefComplaint: string;
      historyOfPresentIllness: string;
      pastMedicalHistory: string[];
      vitals: {
        heartRate: number;
        bloodPressure: string;
        temperature: number;
        respiratoryRate: number;
        oxygenSaturation: number;
      };
      physicalExam: {
        heent: string;
        cardiac: string;
        respiratory: string;
        abdomen: string;
        extremities: string;
        neurological: string;
      };
      labs: {
        name: string;
        value: string | number;
        unit: string;
        normalRange: string;
        status: 'normal' | 'abnormal' | 'critical';
        orderedAt?: number;
        availableAt?: number;
        clinicalNote?: string;
      }[];
      imaging: {
        type: string;
        technique?: string;
        findings?: string;
        impression?: string;
        orderedAt?: number;
        availableAt?: number;
      }[];
      medications: {
        id: string;
        name: string;
        dose: string;
        route: string;
        timestamp: number;
      }[];
      activeAlarms: string[];
      correctDiagnosis: string;
      explanation: string;
      currentCondition: string;
      physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical';
      simulationTime: number;
      currentLocation: string;
      difficulty: 'intern' | 'resident' | 'attending';
      category: 'cardiology' | 'pulmonology' | 'sepsis' | 'trauma' | 'neurology' | 'toxicology';
      communicationLog: {
        id: string;
        timestamp: number;
        from: string;
        to: string;
        message: string;
        type: 'call' | 'text' | 'consult';
      }[];
      clinicalActions: {
        id: string;
        timestamp: string;
        type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication';
        description: string;
        result?: string;
        impact?: string;
      }[];
    }
  `;

  // Helper: validate that required fields exist in request body
  function validateBody(body: Record<string, unknown>, requiredFields: string[]): string | null {
    for (const field of requiredFields) {
      if (body[field] === undefined || body[field] === null) {
        return `Missing required field: ${field}`;
      }
    }
    return null;
  }

  // API Routes
  app.post("/api/generate-case", async (req: Request, res: Response) => {
    try {
      const { category, difficulty, history } = req.body;

      const historyContext = history && Array.isArray(history) && history.length > 0 
        ? `User's Recent Case History: ${history.map((h: { category?: string; score?: number }) => `${h.category || 'unknown'} (${h.score ?? 0}%)`).join(", ")}. Avoid repeating the exact clinical presentation from these cases.`
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

            ${historyContext}

            Initialize simulationTime at 0. Initialize currentLocation as "Emergency Room (ER) Bay 1". 
            Initialize communicationLog, medications, and activeAlarms as empty arrays.
            Initialize physiologicalTrend as 'stable' or 'declining' based on acuity.
            ALL labs and imaging should NOT have orderedAt or availableAt yet. 
            Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`
          },
          {
            role: "user",
            content: `Generate a realistic ${difficulty || 'resident'} level case in the category of ${category || 'any'}.`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI");
      
      const parsed = JSON.parse(content);
      res.json(parsed);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate case";
      console.error("DeepSeek Error:", message);
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/perform-intervention", async (req: Request, res: Response) => {
    try {
      const { intervention, medicalCase, waitTime } = req.body;

      const validationError = validateBody(req.body, ["intervention", "medicalCase"]);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a clinical simulator. Analyze the intervention/wait-time. 
            Update the MedicalCase state based on the following rules:
            1. Advanced simulationTime by ${waitTime || 5} minutes.
            2. Update physiologicalTrend based on interventions (e.g. Fluids/Vasopressors move it towards 'improving').
            3. Update vitals realistically. If trend is 'declining', vitals should drift towards disaster (HR up, BP down, etc.).
            4. If action is "Transfer to [Dept]", update currentLocation accordingly.
            5. If intervention involves medication (e.g. "Administer [Drug] [Dose]"), add to 'medications' array.
            6. If vitals are critical (extremes), add descriptive strings to 'activeAlarms' (e.g. "Low SpO2", "Bradycardia").
            7. If an intervention was "Order lab: [name]" or "Order imaging: [type]", handle orderedAt/availableAt. 
            8. Lab "clinicalNote" should include relevant path/tech comments (e.g. "Toxic granulation seen", "Consistent with dehydration").
            9. Imaging 'findings' and 'impression' MUST be professional radiologic reports.
            10. If the patient is transferred to a new department, appropriately update 'currentLocation'. 
            11. Add a log entry to clinicalActions.
            
            CRITICAL: Return the ENTIRE MedicalCase object.
            Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`
          },
          {
            role: "user",
            content: `Current Case State: ${JSON.stringify(medicalCase)}. 
            Action Taken: ${intervention}. 
            Wait Time: ${waitTime || 5} min.`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI");
      
      const updatedCase = JSON.parse(content);
      if (!updatedCase.vitals || !updatedCase.labs || !updatedCase.imaging) {
         throw new Error("AI returned an incomplete medical case object.");
      }
      
      res.json(updatedCase);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Simulator failed to process intervention.";
      console.error("Intervention Error:", message);
      res.status(500).json({ error: "Simulator failed to process intervention." });
    }
  });

  app.post("/api/staff-call", async (req: Request, res: Response) => {
    try {
      const { target, message, medicalCase } = req.body;

      const validationError = validateBody(req.body, ["target", "message", "medicalCase"]);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      
      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a healthcare professional (Consultant/Nurse/Radiologist). 
            Respond to the user's call/message realistically based on the patient's current state. 
            Keep it clinical and concise. 
            Return a JSON object: { "reply": string, "updatedCase": MedicalCase }
            Add the exchange to communicationLog.
            Schema: ${MEDICAL_CASE_SCHEMA}`
          },
          {
            role: "user",
            content: `Patient state: ${JSON.stringify(medicalCase)}. 
            Communication target: ${target}. 
            Message: ${message}.`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(content));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Communication failed.";
      console.error("Call Error:", message);
      res.status(500).json({ error: "Communication failed." });
    }
  });

  app.post("/api/evaluate-diagnosis", async (req: Request, res: Response) => {
    try {
      const { userDiagnosis, medicalCase } = req.body;

      const validationError = validateBody(req.body, ["userDiagnosis", "medicalCase"]);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: "You are a medical examiner. Evaluate the user's diagnostic accuracy. Respond ONLY with a JSON object: { \"score\": number, \"feedback\": string }"
          },
          {
            role: "user",
            content: `Evaluate diagnosis: "${userDiagnosis}" for the following case: ${JSON.stringify(medicalCase)}`
          }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(content));
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to evaluate diagnosis";
      console.error("DeepSeek Evaluation Error:", message);
      res.status(500).json({ error: message });
    }
  });

  // Global Error Handler for API
  app.use("/api", (err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("API error:", err.message);
    res.status(500).json({ error: "API Internal Error" });
  });

  // Vite middleware for development
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
