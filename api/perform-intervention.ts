import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "../src/lib/schema";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  if (typeof body.intervention !== "string" || body.intervention.trim() === "") {
    throw new Error("Missing or invalid field: intervention (must be a non-empty string).");
  }
  if (!body.medicalCase || typeof body.medicalCase !== "object") {
    throw new Error("Missing or invalid field: medicalCase.");
  }
  const waitTime = Number(body.waitTime);
  if (body.waitTime !== undefined && (isNaN(waitTime) || waitTime < 0 || waitTime > 1440)) {
    throw new Error("Invalid waitTime: must be a number between 0 and 1440.");
  }
  return {
    intervention: body.intervention.trim() as string,
    medicalCase: body.medicalCase,
    waitTime: isNaN(waitTime) ? 5 : waitTime,
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
    const { intervention, medicalCase, waitTime } = validateRequest(req.body);

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
1. Advance simulationTime by ${waitTime} minutes.
2. Update physiologicalTrend based on interventions (e.g. Fluids/Vasopressors move it towards 'improving').
3. Update vitals realistically. If trend is 'declining', vitals should drift towards disaster (HR up, BP down, etc.).
4. If action is "Transfer to [Dept]", update currentLocation accordingly.
5. If intervention involves medication (e.g. "Administer [Drug] [Dose]"), add to 'medications' array.
   - If the medication is an IV fluid (NS, LR, Albumin, colloids, crystalloids), set isIVFluid: true and volumeML to the appropriate volume in mL.
6. If vitals are critical (extremes), add descriptive strings to 'activeAlarms' (e.g. "Low SpO2", "Bradycardia").
7. If an intervention was "Order lab: [name]" or "Order imaging: [type]", handle orderedAt/availableAt.
8. Lab "clinicalNote" should include relevant path/tech comments (e.g. "Toxic granulation seen").
9. Imaging 'findings' and 'impression' MUST be professional radiologic reports.
10. If the patient is transferred to a new department, update 'currentLocation'.
11. Add a log entry to clinicalActions.
12. PATIENT OUTCOME: Set patientOutcome based on vitals:
    - "deceased" if HR < 20 or HR > 200 or SBP < 50 or SpO2 < 60 or temp < 32 or temp > 42.
    - "critical_deterioration" if physiologicalTrend is 'critical' for 2+ consecutive states.
    - Otherwise "alive".

CRITICAL: Return the ENTIRE MedicalCase object.
Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Current Case State: ${JSON.stringify(trimCase(medicalCase))}.
Action Taken: ${intervention}.
Wait Time: ${waitTime} min.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI");

    const updatedCase = JSON.parse(content);
    if (!updatedCase.vitals || !updatedCase.labs || !updatedCase.imaging) {
      throw new Error("AI returned an incomplete medical case object.");
    }

    // Preserve original id in case AI drops it
    if (!updatedCase.id && medicalCase.id) {
      updatedCase.id = medicalCase.id;
    }

    res.json(updatedCase);
  } catch (error: any) {
    console.error("Intervention Error:", error);
    res.status(500).json({ error: "Simulator failed to process intervention." });
  }
}
