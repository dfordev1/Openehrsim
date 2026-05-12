import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";

// Validate required request fields
function validateRequest(body: any): { medicalCase: any } {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  if (!body.medicalCase || typeof body.medicalCase !== "object") {
    throw new Error("Missing or invalid field: medicalCase");
  }
  return { medicalCase: body.medicalCase };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { medicalCase } = validateRequest(req.body);

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY.includes("MY_")) {
      return res.status(500).json({ error: "GEMINI_API_KEY is not configured in environment variables." });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Trim payload: only send relevant clinical info, not full history arrays
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
      // Only last 5 actions/comms to keep prompt lean
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
              description:
                "The underlying pathophysiological or clinical reasoning for the advice.",
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
}
