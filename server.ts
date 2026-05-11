import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import OpenAI from "openai";
import { MedicalCase } from "./src/types";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const openai = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
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

  // API Routes
  app.post("/api/generate-case", async (req, res) => {
    try {
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
        return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in Secrets." });
      }

      const response = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a high-fidelity clinical simulation engine. Generate a complex, acute medical case. 
            Initialize simulationTime at 0. Initialize currentLocation as "Emergency Room (ER) Bay 1". 
            Initialize communicationLog, medications, and activeAlarms as empty arrays.
            Initialize physiologicalTrend as 'stable' or 'declining' based on acuity.
            ALL labs and imaging should NOT have orderedAt or availableAt yet. 
            Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`
          },
          {
            role: "user",
            content: "Generate a realistic emergency case requiring precise intervention (e.g. Septic Shock, Aortic Dissection, Massive PE)."
          }
        ],
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("DeepSeek Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate case" });
    }
  });

  app.post("/api/perform-intervention", async (req, res) => {
    try {
      const { intervention, medicalCase, waitTime } = req.body;
      
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
            8. Imaging 'findings' and 'impression' MUST be professional radiologic reports.
            9. Add a log entry to clinicalActions.
            
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

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");
      
      const updatedCase = JSON.parse(content);
      if (!updatedCase.vitals || !updatedCase.labs || !updatedCase.imaging) {
         throw new Error("AI returned an incomplete medical case object.");
      }
      
      res.json(updatedCase);
    } catch (error: any) {
      console.error("Intervention Error:", error);
      res.status(500).json({ error: "Simulator failed to process intervention." });
    }
  });

  // NEW: Direct Communication API
  app.post("/api/staff-call", async (req, res) => {
    try {
      const { target, message, medicalCase } = req.body;
      
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

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("Call Error:", error);
      res.status(500).json({ error: "Communication failed." });
    }
  });

  app.post("/api/evaluate-diagnosis", async (req, res) => {
    try {
      const { userDiagnosis, medicalCase } = req.body;
      
      if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
        return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });
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

      const content = response.choices[0].message.content;
      if (!content) throw new Error("Empty response from AI");
      
      res.json(JSON.parse(content));
    } catch (error: any) {
      console.error("DeepSeek Evaluation Error:", error);
      res.status(500).json({ error: error.message || "Failed to evaluate diagnosis" });
    }
  });

  // Global Error Handler for API
  app.use("/api", (err: any, req: any, res: any, next: any) => {
    console.error("API error:", err);
    res.status(500).json({ error: "API Internal Error", details: err.message });
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
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
