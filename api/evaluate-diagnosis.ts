import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "sk-b79bd35ec3064714bdce2306ebb38369";

const openai = new OpenAI({
  apiKey: DEEPSEEK_KEY,
  baseURL: "https://api.deepseek.com",
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { userDiagnosis, medicalCase } = req.body;
    if (!userDiagnosis || !medicalCase) return res.status(400).json({ error: "Missing userDiagnosis or medicalCase" });

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

    res.status(200).json(JSON.parse(content));
  } catch (error: any) {
    console.error("Evaluation Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to evaluate diagnosis" });
  }
}
