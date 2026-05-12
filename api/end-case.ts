import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";

/**
 * CCS-Style Case Completion & Scoring Endpoint
 * 
 * Evaluates the user's management of the case based on:
 * - Appropriate orders (labs, imaging, medications)
 * - Timing of critical interventions
 * - Patient outcome
 * - Efficiency (avoiding unnecessary tests)
 * - Clinical reasoning
 * 
 * Returns management critique, not just diagnosis comparison
 */

interface EndCaseRequest {
  caseId: string;
  medicalCase: any;  // The current state from frontend
  userNotes?: string;  // Optional final assessment/notes
}

function validateRequest(body: any): EndCaseRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  if (!body.caseId || typeof body.caseId !== "string") {
    throw new Error("Missing or invalid field: caseId");
  }
  if (!body.medicalCase || typeof body.medicalCase !== "object") {
    throw new Error("Missing or invalid field: medicalCase");
  }
  
  return {
    caseId: body.caseId,
    medicalCase: body.medicalCase,
    userNotes: body.userNotes || "",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { caseId, medicalCase, userNotes } = validateRequest(req.body);

    // Retrieve the full case with correct diagnosis
    if (!global.casesStore || !global.casesStore.has(caseId)) {
      return res.status(404).json({ error: "Case not found. Cannot score." });
    }

    const fullCase = global.casesStore.get(caseId);

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in environment variables." });
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });

    // Build action summary for scoring
    const actionSummary = (medicalCase.clinicalActions || [])
      .map((a: any) => `T+${a.timestamp}: ${a.description}`)
      .join('\n');

    const medicationSummary = (medicalCase.medications || [])
      .map((m: any) => `T+${m.timestamp}: ${m.name} ${m.dose} ${m.route}`)
      .join('\n');

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a USMLE Step 3 CCS case evaluator. Score the user's MANAGEMENT, not just their diagnosis.

CORRECT DIAGNOSIS: ${fullCase.correctDiagnosis}
EXPLANATION: ${fullCase.explanation || "No explanation provided"}

SCORING CRITERIA (100 points total):
1. Initial Management (25 pts):
   - Appropriate initial orders (vitals monitoring, O2, IV access, basic labs)
   - Recognition of acuity level
   
2. Diagnostic Workup (25 pts):
   - Ordered appropriate tests for differential diagnosis
   - Timing: critical tests ordered early
   - Avoided unnecessary/harmful tests
   
3. Therapeutic Interventions (30 pts):
   - Correct treatment for underlying condition
   - Timing: critical interventions (antibiotics for sepsis, fluids for shock) started early
   - Appropriate medication dosing
   
4. Patient Outcome (20 pts):
   - Patient survived: +20
   - Patient deteriorated: -10
   - Patient deceased from preventable cause: -20

EFFICIENCY PENALTIES:
- Too many unnecessary tests: -5 to -15 points
- Delayed critical intervention: -5 to -15 points per delay

OUTPUT FORMAT (JSON):
{
  "score": number (0-100),
  "breakdown": {
    "initialManagement": number (0-25),
    "diagnosticWorkup": number (0-25),
    "therapeuticInterventions": number (0-30),
    "patientOutcome": number (-20 to +20)
  },
  "feedback": "Detailed paragraph explaining performance",
  "correctDiagnosis": "${fullCase.correctDiagnosis}",
  "keyActions": ["✓ Action they did well", "✗ Action they missed or delayed"],
  "criticalMissed": ["Critical intervention they missed"],
  "clinicalPearl": "One teaching point from this case"
}`,
        },
        {
          role: "user",
          content: `CASE PRESENTATION:
Chief Complaint: ${medicalCase.chiefComplaint}
Initial Vitals: HR ${medicalCase.vitals.heartRate}, BP ${medicalCase.vitals.bloodPressure}, RR ${medicalCase.vitals.respiratoryRate}, SpO2 ${medicalCase.vitals.oxygenSaturation}%, Temp ${medicalCase.vitals.temperature}°C

ACTIONS TAKEN:
${actionSummary || "No actions recorded"}

MEDICATIONS GIVEN:
${medicationSummary || "No medications administered"}

FINAL STATE:
- Simulation Time: ${medicalCase.simulationTime} minutes
- Patient Outcome: ${medicalCase.patientOutcome || "alive"}
- Physiological Trend: ${medicalCase.physiologicalTrend}
- Final Vitals: HR ${medicalCase.vitals.heartRate}, BP ${medicalCase.vitals.bloodPressure}, SpO2 ${medicalCase.vitals.oxygenSaturation}%

USER NOTES: ${userNotes || "None provided"}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI evaluator");

    const evaluation = JSON.parse(content);

    // Clean up the case from storage
    global.casesStore.delete(caseId);

    res.json({
      ...evaluation,
      caseId,
      totalSimulationTime: medicalCase.simulationTime,
      explanation: fullCase.explanation,
    });
  } catch (error: any) {
    console.error("End Case Error:", error);
    res.status(500).json({ error: error.message || "Failed to evaluate case." });
  }
}
