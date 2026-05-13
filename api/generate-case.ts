import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "../src/lib/schema.js";
import { LOCKED_SENTINEL } from "../src/lib/constants.js";
import { storeCaseServerSide } from "./_supabase.js";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  // Be permissive — pass any category/difficulty/environment to the AI.
  // Default difficulty to "resident", environment to "tertiary" if invalid.
  const validDifficulties = ["intern", "resident", "attending"];
  const validEnvironments = ["rural", "prehospital", "tertiary"];
  return {
    category:    typeof body.category === "string" ? body.category : undefined,
    difficulty:  validDifficulties.includes(body.difficulty) ? body.difficulty : "resident",
    history:     Array.isArray(body.history) ? body.history : [],
    environment: validEnvironments.includes(body.environment) ? body.environment : "tertiary",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { category, difficulty, history, environment } = validateRequest(req.body);

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_"))
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });

    const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });

    const envCtx =
      environment === "rural"
        ? "SETTING: Rural Critical Access Hospital. Limited resources — CT takes 60 min, no MRI, slow labs."
        : environment === "prehospital"
        ? "SETTING: Pre-hospital (Ambulance). Only portable monitor + basic meds. No labs or imaging in field."
        : "SETTING: Level 1 Tertiary Trauma Center. All resources available.";

    const historyCtx =
      history.length > 0
        ? `User's recent case history: ${history.map((h: any) => `${h.category} (${h.score}%)`).join(", ")}. Do NOT repeat the same presentation.`
        : "";

    const aiRes = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a high-fidelity USMLE Step 3 CCS examiner creating a clinical simulation case.
Generate a COMPLETE, CHALLENGING case including the hidden answer key.

${envCtx}
${historyCtx}

━━━ DIFFICULTY CONTRACT ━━━
intern:
  • Single-system illness, textbook presentation
  • 2-3 differential diagnoses (one obvious, one plausible alternative)
  • Vitals clearly abnormal; diagnosis apparent from initial data
  • Comorbidities: 1 (e.g. hypertension only)
  • No red herrings

resident:
  • Multi-system involvement or atypical age/gender presentation
  • 4-6 differential diagnoses; correct diagnosis NOT the first obvious one
  • ONE deliberate red herring (a finding that suggests a wrong diagnosis)
  • Comorbidities: 2-3 that actively complicate management (e.g. CKD affecting dosing, anticoagulation, COPD changing O2 targets)
  • Time-critical window: one key intervention has an explicit penalty if delayed >30 min
  • Vitals: at least 2 abnormal values; one mild, one critical

attending:
  • Rare disease OR common disease with rare/atypical presentation OR two simultaneous conditions
  • 6+ differential diagnoses; misleading initial picture that pivots after key test
  • TWO red herrings — one in history, one in labs
  • Comorbidities: 3-4 creating management conflicts (e.g. renal failure + sepsis + coagulopathy)
  • Silent or masked symptoms (e.g. elderly/diabetic/immunocompromised with blunted response)
  • Requires subspecialty-level reasoning to score >80%
  • Vitals: subtle or paradoxically "normal-looking" despite critical underlying condition

━━━ REALISM REQUIREMENTS (all difficulties) ━━━
• HPI: 4-6 sentences with specific timeline (onset hours/days), aggravating/relieving factors, and 1-2 associated symptoms. Do NOT mention the diagnosis.
• Vitals: must be physiologically consistent with the diagnosis (e.g. sepsis = tachycardia + low BP + high RR; pulmonary embolism = tachycardia + low SpO2 + normal temperature)
• Labs: include at minimum 12 labs with SPECIFIC abnormal values, units, and normal ranges. Values must tell a coherent pathophysiological story. Include at least one spuriously reassuring normal value that could mislead.
• Imaging: include 2-3 studies with detailed findings (multiple sentences) and impression. One imaging study should be non-specific or normal to add diagnostic uncertainty.
• Physical exam: each system should have a 2-3 sentence detailed finding, not "normal" or one word. Subtle findings matter.
• availableTests: provide a comprehensive catalogue of ≥20 labs and ≥8 imaging options the user can order.
• underlyingPathology: detailed 4-6 sentence pathophysiology that explains how the patient will evolve — used to drive realistic deterioration if wrong treatment is given.

━━━ REQUIRED JSON FIELDS ━━━
  id                  : unique short id e.g. "case-a1b2c3"
  patientName         : realistic full name
  age / gender
  chiefComplaint      : one sentence
  historyOfPresentIllness : 4-6 sentences (see above)
  pastMedicalHistory  : string[] — 2-4 relevant comorbidities with durations
  initialAppearance   : vivid 2-sentence bedside impression including affect, skin, breathing pattern
  vitals              : { heartRate, bloodPressure, temperature, respiratoryRate, oxygenSaturation }
  physicalExam        : { heent, cardiac, respiratory, abdomen, extremities, neurological }
  labs                : FULL array WITH specific values — NO orderedAt/availableAt yet
  imaging             : FULL array WITH detailed findings/impression — NO orderedAt/availableAt yet
  availableTests      : { labs: string[], imaging: string[] }
  medications         : []
  activeAlarms        : [] or critical alarms if vitals warrant
  currentCondition    : one-line clinical status
  physiologicalTrend  : "stable" | "declining"
  simulationTime      : 0
  currentLocation     : ${environment === "prehospital" ? '"Ambulance Rescue 1"' : '"Emergency Room (ER) Bay 1"'}
  communicationLog    : []
  clinicalActions     : []
  difficulty          : "${difficulty || "resident"}"
  category            : pick the most accurate from: cardiology|pulmonology|neurology|nephrology|gastroenterology|endocrinology|hematology_oncology|infectious_disease|sepsis|toxicology|trauma|critical_care|obgyn|psychiatry|rheumatology|vascular_surgery|gi_hepatology|geriatrics
  patientOutcome      : "alive"

  // ANSWER KEY — server-side only, NEVER send to client:
  correctDiagnosis    : precise diagnosis string including aetiology where relevant
  explanation         : 3-4 sentence teaching point covering why this diagnosis, key differentiating features, and the one action most residents miss
  underlyingPathology : 4-6 sentences of detailed pathophysiology driving realistic patient evolution

Output MUST be valid JSON matching: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Generate a ${difficulty || "resident"}-level case — category: ${category || "any"}. Make it genuinely challenging. Do not default to the most common presentation.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = aiRes.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI");

    const fullCase = JSON.parse(content);
    if (!fullCase.id) fullCase.id = `case-${Math.random().toString(36).slice(2, 9)}`;

    // ── Persist FULL case server-side (Supabase or in-memory fallback) ──────
    await storeCaseServerSide(fullCase.id, fullCase);

    // ── Return MINIMAL presentation to client (no answer key) ────────────────
    const { correctDiagnosis, explanation, underlyingPathology, ...clientCase } = fullCase;

    // Clear lab/imaging results — user must ORDER them
    clientCase.labs    = [];
    clientCase.imaging = [];

    // Physical exam starts locked
    clientCase.physicalExam = Object.fromEntries(
      Object.keys(fullCase.physicalExam || {}).map((k) => [k, LOCKED_SENTINEL])
    );

    res.json(clientCase);
  } catch (err: any) {
    console.error("generate-case error:", err);
    res.status(500).json({ error: err.message || "Failed to generate case" });
  }
}
