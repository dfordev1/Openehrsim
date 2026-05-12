import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { target, message, medicalCase } = req.body;

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
}
