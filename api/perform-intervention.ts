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
    const { intervention, medicalCase, waitTime } = req.body;

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
}
