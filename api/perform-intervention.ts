import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY || "sk-b79bd35ec3064714bdce2306ebb38369";

const openai = new OpenAI({
  apiKey: DEEPSEEK_KEY,
  baseURL: "https://api.deepseek.com",
});

const MEDICAL_CASE_SCHEMA = `interface MedicalCase { id: string; patientName: string; age: number; gender: string; chiefComplaint: string; historyOfPresentIllness: string; pastMedicalHistory: string[]; vitals: { heartRate: number; bloodPressure: string; temperature: number; respiratoryRate: number; oxygenSaturation: number; }; physicalExam: { heent: string; cardiac: string; respiratory: string; abdomen: string; extremities: string; neurological: string; }; labs: { name: string; value: string | number; unit: string; normalRange: string; status: 'normal' | 'abnormal' | 'critical'; orderedAt?: number; availableAt?: number; clinicalNote?: string; }[]; imaging: { type: string; technique?: string; findings?: string; impression?: string; orderedAt?: number; availableAt?: number; }[]; medications: { id: string; name: string; dose: string; route: string; timestamp: number; }[]; activeAlarms: string[]; correctDiagnosis: string; explanation: string; currentCondition: string; physiologicalTrend: 'improving' | 'stable' | 'declining' | 'critical'; simulationTime: number; currentLocation: string; difficulty: 'intern' | 'resident' | 'attending'; category: 'cardiology' | 'pulmonology' | 'sepsis' | 'trauma' | 'neurology' | 'toxicology'; communicationLog: { id: string; timestamp: number; from: string; to: string; message: string; type: 'call' | 'text' | 'consult'; }[]; clinicalActions: { id: string; timestamp: string; type: 'order' | 'medication' | 'procedure' | 'exam' | 'transfer' | 'communication'; description: string; result?: string; impact?: string; }[]; }`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { intervention, medicalCase, waitTime } = req.body;
    if (!intervention || !medicalCase) return res.status(400).json({ error: "Missing intervention or medicalCase" });

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a clinical simulator. Update the MedicalCase state:
          1. Advance simulationTime by ${waitTime || 5} minutes.
          2. Update physiologicalTrend based on interventions.
          3. Update vitals realistically.
          4. If "Transfer to [Dept]", update currentLocation.
          5. If medication, add to medications array.
          6. If critical vitals, add to activeAlarms.
          7. If "Order lab/imaging", set orderedAt/availableAt.
          8. Add clinicalNote to labs.
          9. Imaging findings must be professional.
          10. Add log entry to clinicalActions.
          CRITICAL: Return the ENTIRE MedicalCase object as valid JSON.
          Schema: ${MEDICAL_CASE_SCHEMA}`
        },
        {
          role: "user",
          content: `Current Case State: ${JSON.stringify(medicalCase)}. Action Taken: ${intervention}. Wait Time: ${waitTime || 5} min.`
        }
      ],
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) throw new Error("Empty response from AI");

    const updatedCase = JSON.parse(content);
    if (!updatedCase.vitals || !updatedCase.labs || !updatedCase.imaging) {
      throw new Error("AI returned incomplete case.");
    }
    res.status(200).json(updatedCase);
  } catch (error: any) {
    console.error("Intervention Error:", error.message);
    res.status(500).json({ error: "Simulator failed to process intervention." });
  }
}
