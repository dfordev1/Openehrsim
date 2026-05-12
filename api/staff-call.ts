import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "../src/lib/schema.js";

const VALID_TARGETS = [
  "Nursing Station",
  "Radiology Desk",
  "Laboratory Tech",
  "Cardiology Consult",
  "Surgery Resident",
  "ICU Attending",
  "Pharmacy",
  "Social Work",
];

function validateRequest(body: any) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  if (typeof body.target !== "string" || body.target.trim() === "") {
    throw new Error("Missing or invalid field: target.");
  }
  if (typeof body.message !== "string" || body.message.trim() === "") {
    throw new Error("Missing or invalid field: message (must be a non-empty string).");
  }
  if (body.message.length > 1000) {
    throw new Error("Message too long (max 1000 characters).");
  }
  if (!body.medicalCase || typeof body.medicalCase !== "object") {
    throw new Error("Missing or invalid field: medicalCase.");
  }
  return {
    target: body.target.trim() as string,
    message: body.message.trim() as string,
    medicalCase: body.medicalCase,
  };
}

/** Trim the MedicalCase payload to avoid unbounded growth in request size */
function trimCase(mc: any) {
  return {
    ...mc,
    clinicalActions: (mc.clinicalActions || []).slice(-10),
    communicationLog: (mc.communicationLog || []).slice(-10),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { target, message, medicalCase } = validateRequest(req.body);

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
          content: `You are a healthcare professional (${target}).
Respond to the physician's message realistically based on the patient's current state.
Keep it clinical and concise.
Return a JSON object: { "reply": string, "updatedCase": MedicalCase }
Add the exchange to communicationLog in updatedCase.
Preserve the original case id field exactly.
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

    // Preserve original id in case AI drops it
    if (parsed.updatedCase && !parsed.updatedCase.id && medicalCase.id) {
      parsed.updatedCase.id = medicalCase.id;
    }

    res.json(parsed);
  } catch (error: any) {
    console.error("Call Error:", error);
    res.status(500).json({ error: "Communication line disrupted." });
  }
}
