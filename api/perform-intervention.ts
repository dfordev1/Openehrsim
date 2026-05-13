/**
 * CCS-style intervention + time-advance endpoint.
 *
 * Reads full case from Supabase (pathology, underlying dx) to evolve
 * the patient realistically without leaking the answer to the client.
 * Writes updated full case back after each step.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "../src/lib/schema.js";
import { getCaseServerSide, updateCaseServerSide } from "./_supabase.js";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  if (!body.medicalCase || typeof body.medicalCase !== "object")
    throw new Error("Missing: medicalCase");
  const waitTime = Number(body.waitTime);
  if (!isNaN(waitTime) && (waitTime < 0 || waitTime > 1440))
    throw new Error("waitTime must be 0–1440.");
  return {
    intervention: body.intervention ? String(body.intervention).trim() : "",
    medicalCase:  body.medicalCase,
    waitTime:     isNaN(waitTime) ? 5 : waitTime,
  };
}

function trimCase(mc: any) {
  return {
    ...mc,
    clinicalActions:  (mc.clinicalActions  || []).slice(-12),
    communicationLog: (mc.communicationLog || []).slice(-10),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { intervention, medicalCase, waitTime } = validateRequest(req.body);

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_"))
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });

    const newSimTime = (medicalCase.simulationTime || 0) + waitTime;

    // ── Pull server-side pathology context ────────────────────────────────────
    const fullCase = await getCaseServerSide(medicalCase.id);
    const pathologyCtx = fullCase
      ? `HIDDEN PATHOLOGY (use ONLY to drive realistic evolution — NEVER reveal to user):
Correct Diagnosis: ${fullCase.correctDiagnosis}
Underlying Pathology: ${fullCase.underlyingPathology || "not specified"}
Explanation: ${fullCase.explanation || ""}`
      : "No server-side context available — evolve realistically based on current vitals.";

    const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });

    const aiRes = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are the patient state engine for the world's most demanding clinical simulator. Your role is to evolve a complex, multi-specialty patient with uncompromising physiological realism.

${pathologyCtx}

RULES:
1. Evolve vitals realistically based on the hidden pathology + interventions given.
   - Correct treatment → improving trend
   - No/wrong treatment → worsening; untreated sepsis/shock WILL deteriorate
2. If intervention is a medication, add to medications[] (with timestamp ${newSimTime}).
   IV fluids → isIVFluid:true, volumeML:[appropriate].
3. Update activeAlarms based on current vitals (e.g. "Hypotension", "Tachycardia").
4. Update physiologicalTrend: improving | stable | declining | critical.
5. If "Transfer to X", update currentLocation.
6. Append one entry to clinicalActions (timestamp: ${newSimTime}).
7. patientOutcome:
   - "deceased" if HR<20 or HR>200 or SBP<50 or SpO2<60 or temp<32 or temp>42
   - "critical_deterioration" if trend is 'critical' and vitals worsening
   - otherwise "alive"
8. DO NOT modify labs or imaging arrays — those are managed separately.
9. DO NOT include correctDiagnosis or explanation in the response.

Return the ENTIRE updated MedicalCase JSON. Schema: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Current state: ${JSON.stringify(trimCase(medicalCase))}
${intervention ? `Intervention: ${intervention}` : "Time advancement only — no active intervention."}
Time advances by ${waitTime} min (${medicalCase.simulationTime} → ${newSimTime}).`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = aiRes.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI");

    const updated = JSON.parse(content);
    if (!updated.vitals) throw new Error("AI returned incomplete case.");

    // Deterministic overrides — never trust the AI to do arithmetic correctly
    updated.id             = medicalCase.id;
    updated.simulationTime = newSimTime;   // always the server-calculated value
    updated.availableTests = medicalCase.availableTests || updated.availableTests;

    // Merge ordered tests back (AI must not wipe them)
    updated.labs    = medicalCase.labs    || [];
    updated.imaging = medicalCase.imaging || [];

    // ── Write updated full case back to Supabase ──────────────────────────────
    if (fullCase) {
      await updateCaseServerSide(medicalCase.id, {
        ...fullCase,
        vitals:              updated.vitals,
        physiologicalTrend:  updated.physiologicalTrend,
        currentLocation:     updated.currentLocation,
        simulationTime:      updated.simulationTime,
        activeAlarms:        updated.activeAlarms,
        medications:         updated.medications,
        clinicalActions:     updated.clinicalActions,
        patientOutcome:      updated.patientOutcome,
        currentCondition:    updated.currentCondition,
      });
    }

    // Strip server-only fields before sending to client
    const { correctDiagnosis, explanation, underlyingPathology, ...clientCase } = updated;
    res.json(clientCase);
  } catch (err: any) {
    console.error("perform-intervention error:", err);
    res.status(500).json({ error: "Simulator failed to process intervention." });
  }
}
