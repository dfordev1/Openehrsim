import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "sk-b79bd35ec3064714bdce2306ebb38369";

const openai = new OpenAI({
  apiKey: DEEPSEEK_KEY,
  baseURL: "https://api.deepseek.com",
});

const MEDICAL_CASE_SCHEMA = `
  interface MedicalCase {
    id: string; patientName: string; age: number; gender: string;
    chiefComplaint: string; historyOfPresentIllness: string; pastMedicalHistory: string[];
    vitals: { heartRate: number; bloodPressure: string; temperature: number; respiratoryRate: number; oxygenSaturation: number; };
    physicalExam: { heent: string; cardiac: string; respiratory: string; abdomen: string; extremities: string; neurological: string; };
    labs: { name: string; value: string | number; unit: string; normalRange: string; status: 'normal' | 'abnormal' | 'critical'; orderedAt?: number; availableAt?: number; clinicalNote?: string; }[];
    imaging: { type: string; technique?: string; findings?: string; impression?: string; orderedAt?: number; availableAt?: number; }[];
    medications: { id: string; name: string; dose: string; route: string; timestamp: number; }[];
    activeAlarms: string[]; correctDiagnosis: string; explanation: string; currentCondition: string;
    physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical';
    simulationTime: number; currentLocation: string;
    difficulty: 'intern' | 'resident' | 'attending';
    category: 'cardiology' | 'pulmonology' | 'sepsis' | 'trauma' | 'neurology' | 'toxicology';
    communicationLog: { id: string; timestamp: number; from: string; to: string; message: string; type: 'call' | 'text' | 'consult'; }[];
    clinicalActions: { id: string; timestamp: string; type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication'; description: string; result?: string; impact?: string; }[];
  }
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { category, difficulty, history } = req.body;

    const historyContext = history && Array.isArray(history) && history.length > 0
      ? `User's Recent Case History: ${history.map((h: any) => `${h.category || 'unknown'} (${h.score ?? 0}%)`).join(", ")}. Avoid repeating the exact clinical presentation from these cases.`
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

    res.status(200).json(JSON.parse(content));
  } catch (error: any) {
    console.error("DeepSeek Error:", error.message);
    res.status(500).json({ error: error.message || "Failed to generate case" });
  }
}
