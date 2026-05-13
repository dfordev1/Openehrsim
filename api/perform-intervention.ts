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

    // ── Separate resulted labs (can evolve) from pending labs (must not change) ──
    const resultedLabs = (medicalCase.labs || []).filter(
      (l: any) => typeof l.availableAt === 'number' && l.availableAt <= (medicalCase.simulationTime || 0)
    );
    const pendingLabs = (medicalCase.labs || []).filter(
      (l: any) => typeof l.availableAt !== 'number' || l.availableAt > (medicalCase.simulationTime || 0)
    );

    const evolveLabsCtx = resultedLabs.length > 0
      ? `\n\nEVOLVING LABS — these results are already available to the clinician. Update their values based on disease progression and treatment given. Preserve name/unit/normalRange/orderedAt/availableAt. Return updated values in "evolvedLabs": [{name, value, unit, normalRange, status, clinicalNote?}]\n${resultedLabs.map((l: any) => `  ${l.name}: ${l.value} ${l.unit} (range: ${l.normalRange})`).join('\n')}`
      : '';

    const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });

    const aiRes = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are the patient state engine for the world's most demanding clinical simulator. Your role is to evolve a complex, multi-specialty patient with uncompromising physiological realism.

${pathologyCtx}

EVOLUTION RULES:
1. Set simulationTime = ${newSimTime}.

2. VITALS EVOLUTION — be specific and physiologically rigorous:
   • Correct targeted treatment → gradual, realistic improvement (HR drops 10-20 bpm over 15-30 min; BP rises 10-15 mmHg; SpO2 improves 2-4% per cycle with oxygen therapy)
   • Supportive-only treatment (fluids without treating the underlying cause) → brief stabilisation then continued decline
   • Wrong treatment or untreated: deteriorate decisively — untreated septic shock WILL progress to multi-organ failure; untreated PE WILL cause RV strain; untreated stroke WILL expand
   • Comorbidities affect response: β-blocker patients cannot mount expected tachycardia; dialysis patients will not auto-correct electrolytes; immunocompromised patients will not mount expected fever

3. MULTI-ORGAN CASCADE — this is a complex multi-specialty case:
   • Wrong management of the primary condition should trigger secondary organ involvement
   • Deterioration should cross specialty lines: e.g., haemodynamic compromise → AKI → electrolyte crisis; respiratory failure → cerebral hypoxia; hepatic dysfunction → coagulopathy
   • If a management conflict exists (e.g., treating one condition worsens another), reflect this in vitals and currentCondition
   • Name specific complications that are developing in currentCondition

4. MEDICATIONS: if intervention is a medication, add to medications[] (timestamp: ${newSimTime}). IV fluids → isIVFluid:true, volumeML:[appropriate amount]. Inappropriate medication dose or route should NOT improve the patient.

5. ALARMS: update activeAlarms to reflect current vitals precisely. Multiple simultaneous alarms are realistic for a deteriorating multi-system patient.

6. TREND: physiologicalTrend must reflect the TRAJECTORY, not just the current state:
   • improving: vitals moving toward normal range due to correct targeted treatment
   • stable: no significant change (may still be critically ill but not worsening)
   • declining: measurable worsening trend
   • critical: rapid deterioration, imminent organ failure or death without immediate intervention

7. LOCATION: update currentLocation if intervention is a transfer order.

8. CLINICAL ACTIONS: append one entry (timestamp: ${newSimTime}) describing what happened and its impact.

9. OUTCOME:
   • "deceased" if HR<20 or HR>200, SBP<50, SpO2<55%, temp<31°C or temp>43°C sustained, or documented cardiac arrest
   • "critical_deterioration" if physiologicalTrend is "critical" and vitals are worsening each cycle
   • "alive" otherwise

10. LABS: do NOT include a "labs" array in your response — lab values are merged server-side.
11. NEVER include correctDiagnosis, explanation, or underlyingPathology in the response.
${evolveLabsCtx}

Return the ENTIRE updated MedicalCase JSON (without labs[]). Schema: ${MEDICAL_CASE_SCHEMA}`,
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

    // Evolve already-resulted labs; keep pending labs untouched
    const evolvedFromAI: any[] = Array.isArray(updated.evolvedLabs) ? updated.evolvedLabs : [];
    delete updated.evolvedLabs;
    const mergedResulted = resultedLabs.map((rl: any) => {
      const update = evolvedFromAI.find(
        (e: any) => e.name?.toLowerCase() === rl.name?.toLowerCase()
      );
      return update
        ? { ...rl, value: update.value, status: update.status ?? rl.status, clinicalNote: update.clinicalNote ?? rl.clinicalNote }
        : rl;
    });
    updated.labs    = [...mergedResulted, ...pendingLabs];
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
