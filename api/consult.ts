import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { GoogleGenAI, Type } from "@google/genai";

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
      return res.status(500).json({
        error: "No AI API key configured. Set DEEPSEEK_API_KEY or GEMINI_API_KEY.",
      });
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });

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
}
