import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  if (typeof body.userDiagnosis !== "string" || body.userDiagnosis.trim() === "") {
    throw new Error("Missing or invalid field: userDiagnosis (must be a non-empty string).");
  }
  if (body.userDiagnosis.length > 2000) {
    throw new Error("userDiagnosis too long (max 2000 characters).");
  }
  if (!body.medicalCase || typeof body.medicalCase !== "object") {
    throw new Error("Missing or invalid field: medicalCase.");
  }
  return {
    userDiagnosis: body.userDiagnosis.trim() as string,
    medicalCase: body.medicalCase,
  };
}

/** Only send clinically relevant fields for evaluation, not the full case blob */
function trimCaseForEval(mc: any) {
  return {
    patientName: mc.patientName,
    age: mc.age,
    gender: mc.gender,
    chiefComplaint: mc.chiefComplaint,
    historyOfPresentIllness: mc.historyOfPresentIllness,
    vitals: mc.vitals,
    physicalExam: mc.physicalExam,
    labs: mc.labs,
    imaging: mc.imaging,
    correctDiagnosis: mc.correctDiagnosis,
    explanation: mc.explanation,
    simulationTime: mc.simulationTime,
    medications: mc.medications,
    clinicalActions: (mc.clinicalActions || []).slice(-10),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userDiagnosis, medicalCase } = validateRequest(req.body);

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in environment variables." });
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content:
            'You are a medical examiner. Evaluate the user\'s diagnostic accuracy. ' +
            'Consider: accuracy of diagnosis, appropriateness of workup ordered, speed of decision-making, and treatment choices. ' +
            'Respond ONLY with a JSON object: { "score": number (0-100), "feedback": string }',
        },
        {
          role: "user",
          content: `Evaluate diagnosis: "${userDiagnosis}" for the following case: ${JSON.stringify(
            trimCaseForEval(medicalCase)
          )}`,
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
}
