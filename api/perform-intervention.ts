import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "../src/lib/schema.js";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  if (!body.medicalCase || typeof body.medicalCase !== "object") {
    throw new Error("Missing or invalid field: medicalCase.");
  }
  
  // CCS-style: intervention can be empty for pure time advancement
  const intervention = body.intervention ? body.intervention.trim() : "";
  
  const waitTime = Number(body.waitTime);
  if (body.waitTime !== undefined && (isNaN(waitTime) || waitTime < 0 || waitTime > 1440)) {
    throw new Error("Invalid waitTime: must be a number between 0 and 1440.");
  }
  return {
    intervention: intervention as string,
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

    // Get the full case from server-side storage
    if (!global.casesStore || !global.casesStore.has(medicalCase.id)) {
      return res.status(404).json({ 
        error: "Case not found in server storage. Please start a new case." 
      });
    }

    const fullCase = global.casesStore.get(medicalCase.id);
    const newSimTime = medicalCase.simulationTime + waitTime;

    // CCS LOGIC: Reveal test results that are now available
    const revealedLabs = medicalCase.labs.map((lab: any) => {
      if (lab.orderedAt !== undefined && lab.availableAt !== undefined && lab.availableAt <= newSimTime) {
        // Result is now available - keep it
        return lab;
      }
      return lab;  // Keep ordered tests that aren't ready yet
    });

    const revealedImaging = medicalCase.imaging.map((img: any) => {
      if (img.orderedAt !== undefined && img.availableAt !== undefined && img.availableAt <= newSimTime) {
        // Result is now available - keep it
        return img;
      }
      return img;  // Keep ordered tests that aren't ready yet
    });

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in environment variables." });
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });

    // Build context about underlying pathology (server-side only)
    const pathologyContext = fullCase.underlyingPathology 
      ? `UNDERLYING PATHOLOGY (use for realistic evolution): ${fullCase.underlyingPathology}`
      : `CORRECT DIAGNOSIS (use for realistic evolution): ${fullCase.correctDiagnosis}`;

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a CCS-style clinical simulator. Update patient state based on time passage and interventions.

${pathologyContext}

CRITICAL RULES:
1. Advance simulationTime to ${newSimTime} minutes.
2. Evolve vitals realistically based on:
   - Underlying pathology (patient naturally gets worse/better based on disease)
   - Time elapsed (untreated sepsis → worsening, treated MI → improving)
   - Medications given (fluids improve BP, O2 improves SpO2, antibiotics help sepsis)
3. Update physiologicalTrend:
   - 'improving' if appropriate treatment given
   - 'declining' if untreated or wrong treatment
   - 'critical' if vitals dangerously abnormal
4. If intervention involves medication, add to medications array with timestamp ${newSimTime}
   - IV fluids: set isIVFluid: true, volumeML: [appropriate volume]
5. Update activeAlarms based on current vitals (e.g., "Hypotension", "Tachycardia", "Hypoxia")
6. If location change requested, update currentLocation
7. Add action to clinicalActions array (timestamp: ${newSimTime})
8. Update patientOutcome:
   - "deceased" if HR < 20 or > 200, or SBP < 50, or SpO2 < 60
   - "critical_deterioration" if trend is 'critical' and worsening
   - "alive" otherwise
9. DO NOT add any new lab or imaging results - those are handled separately
10. Keep the existing labs and imaging arrays as-is

Return the ENTIRE updated MedicalCase. Schema: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Current State: ${JSON.stringify(trimCase(medicalCase))}.
${intervention ? `Intervention: ${intervention}` : 'Time advancement only (no intervention)'}
Time advancing by ${waitTime} min (from ${medicalCase.simulationTime} to ${newSimTime}).`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI");

    const updatedCase = JSON.parse(content);

    // Merge revealed test results
    updatedCase.labs = revealedLabs;
    updatedCase.imaging = revealedImaging;

    // Ensure critical fields are preserved
    if (!updatedCase.id) updatedCase.id = medicalCase.id;
    if (!updatedCase.availableTests) updatedCase.availableTests = medicalCase.availableTests;

    // Update the full case in storage
    global.casesStore.set(medicalCase.id, {
      ...fullCase,
      ...updatedCase,
    });

    // Return updated case (without server-side fields)
    const { correctDiagnosis, explanation, underlyingPathology, ...clientCase } = updatedCase;

    res.json(clientCase);
  } catch (error: any) {
    console.error("Intervention Error:", error);
    res.status(500).json({ error: "Simulator failed to process intervention." });
  }
}
