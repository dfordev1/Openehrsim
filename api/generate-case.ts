import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "../src/lib/schema.js";
import { LOCKED_SENTINEL } from "../src/lib/constants.js";
import { storeCaseServerSide } from "./_supabase.js";
import { repairJson } from "./_repairJson.js";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
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
        ? "SETTING: Rural Critical Access Hospital. No CT scanner on site (transfer takes 90 min), no MRI, no on-call subspecialists, limited blood bank, point-of-care labs only. Nearest tertiary centre is 2 hours away. Resource scarcity is itself a clinical variable."
        : environment === "prehospital"
        ? "SETTING: Advanced Life Support Ambulance responding to a 911 call. Only portable monitor (12-lead, SpO2, ETCO2), IV access, basic airway adjuncts, and a limited drug box (epinephrine, amiodarone, atropine, aspirin, nitroglycerin, naloxone, D50, normal saline). No labs or imaging. Time to hospital: 20 min."
        : "SETTING: Level I Academic Trauma Centre with full subspecialty coverage, interventional radiology, cardiac cath lab on standby, ECMO team, pharmacy, blood bank, and all advanced diagnostics available 24/7. High-volume tertiary referral centre.";

    const historyCtx =
      history.length > 0
        ? `User's recent case history: ${history.map((h: any) => `${h.category} (${h.score}%)`).join(", ")}. Generate a case from a DIFFERENT specialty cluster. If they scored <60%, the new case should still be challenging but reward systematic reasoning.`
        : "";

    const aiRes = await openai.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are the clinical simulation engine for the world's most demanding medical education platform — the digital equivalent of grand rounds at Mayo Clinic, Johns Hopkins, and the NIH Clinical Center combined.

Your mandate: produce cases so complex that even experienced subspecialty attendings must think carefully. Every case MUST span multiple medical specialties, involve active management conflicts, and contain diagnostic pitfalls that only systematic, evidence-based reasoning will navigate correctly. Simple, single-organ, single-specialty cases are FORBIDDEN.

${envCtx}
${historyCtx}

━━━ MANDATORY MULTI-SPECIALTY REQUIREMENT (ALL DIFFICULTIES) ━━━
• Every case MUST involve ≥2 distinct specialties. Single-specialty cases are NEVER acceptable.
• specialty_tags MUST list every involved specialty.
• The chief complaint must NOT obviously reveal the correct diagnosis.
• At least one involved specialty must be non-obvious from the chief complaint.
• managementConflicts MUST list every active competing treatment priority.
• requiredConsultations MUST list every specialty needed for optimal management.

━━━ PATIENT DEMOGRAPHICS — BREAK THE DEFAULTS ━━━
Do NOT generate a 55-year-old male with the textbook presentation. Rotate through:
• Elderly female (75-90) with atypical presentation and polypharmacy
• Young adult (18-30) with a disease classically seen in older patients
• Middle-aged immunocompromised patient (transplant, HIV, biologics, steroids)
• Pregnant or peripartum patient
• Patient with CKD stage 4-5 / dialysis-dependent
• Morbidly obese patient where exam findings are masked
• Patient with pre-existing neurological or psychiatric comorbidity complicating assessment
• Patient with recent surgery, procedure, or hospital discharge (within 30 days)

━━━ DIFFICULTY CONTRACT ━━━

intern (STILL DEMANDING — this platform has no easy mode):
  • Two intersecting specialties; the primary diagnosis is the less-obvious one
  • 3-5 differential diagnoses; includes ≥1 "don't miss" diagnosis with time-critical treatment
  • 1 active management conflict: the correct treatment for the primary condition has a significant risk given a comorbidity
  • Comorbidities: 2, both relevant to management decisions
  • ONE subtle physical exam finding that points to the diagnosis but is easy to overlook
  • One intervention has a 45-minute window; missing it incurs a documented penalty
  • Labs: ≥15 with specific values, units, and normal ranges — 2 values are mildly abnormal but easy to dismiss; 1 is dangerously misleading (near-normal despite critical pathology)
  • Physical exam: 2-3 sentences per system — no "within normal limits" entries
  • availableTests: ≥30 labs, ≥12 imaging options
  • specialty_tags: exactly 2 specialties
  • requiredConsultations: 1 subspecialty

resident (PUNISHING — separates good from great):
  • Three or more intersecting specialties; the presenting complaint belongs to one specialty, the diagnosis to another
  • Atypical presentation: wrong age, wrong gender, or wrong setting for the classic case
  • 5-7 differential diagnoses; correct diagnosis is NOT the most common or the first you'd reach for
  • ONE deliberate red herring in the history (suggests a plausible but wrong diagnosis)
  • ONE lab result that reinforces the wrong diagnosis (the trap)
  • 2-3 active management conflicts where treating one condition actively worsens another
  • Comorbidities: 3, each creating distinct management complications
  • Silent deterioration: specify exactly which complication will develop if a key intervention is not performed by T+30 min
  • Cross-system physical exam finding: an abnormality in an unexpected system (e.g., ocular finding in a renal case)
  • Labs: ≥18, including a complete metabolic/inflammatory/haematologic story; full pathophysiology must be deducible from the labs alone
  • availableTests: ≥35 labs (include esoteric tests: ADAMTS13, ANCA, complement levels, ferritin kinetics, etc.), ≥15 imaging
  • specialty_tags: 3 specialties
  • requiredConsultations: 2 subspecialties

attending (MASTERY-LEVEL — career-defining cases):
  • Rare disease OR overlap syndrome OR two simultaneous diagnoses with conflicting treatment requirements
  • Presentation that convincingly mimics a common, benign condition for the first 15-20 simulation minutes
  • Pivotal test: one result (lab or imaging) that completely changes the diagnosis — but the clinician must know to ORDER it
  • 7+ differential diagnoses; the correct answer requires subspecialty knowledge to even place on the list
  • TWO red herrings: one embedded in the history, one in the initial labs — each making a different wrong diagnosis seem certain
  • 3+ active management conflicts where EVERY treatment choice has a serious downside
  • Comorbidities: 4, forming a web where each medication affects at least 2 other conditions
  • Multi-organ dysfunction cascade: specify the exact sequence of organ failures that will occur without correct management, including timeline
  • Vitals may be paradoxically normal or near-normal despite critical underlying pathology (masked by medications, autonomic neuropathy, immunosuppression, or compensatory mechanisms)
  • Physical exam: either deceptively subtle findings OR overtly misleading findings pointing away from the correct diagnosis
  • Labs: ≥22 with full pathophysiologic coherence; the complete lab panel should tell the story of multi-organ involvement
  • availableTests: ≥40 labs (highly esoteric: anti-GBM antibody, ADAMTS13 activity, calcitonin, PTHrP, G6PD, serum protein electrophoresis, cryoglobulins, anti-phospholipid panel, etc.), ≥15 imaging
  • specialty_tags: ≥4 specialties
  • requiredConsultations: ≥3 subspecialties

━━━ UNIVERSAL REALISM REQUIREMENTS ━━━
• HPI: 4-6 sentences. Include: exact onset (hours/days), character and severity (1-10), location/radiation, aggravating/relieving factors, 2 associated symptoms. NEVER name the diagnosis. NEVER use textbook language.
• Vitals: physiologically consistent with ALL active pathology AND comorbidities simultaneously. A patient on β-blockers will not have the expected tachycardia. A diabetic may not have expected fever with infection.
• Physical exam: 2-3 sentences per system. Include subtle, easily-overlooked findings. At least one finding should appear in an "unexpected" system. Findings must be consistent with the pathophysiology.
• Labs: every value must have name, specific numeric value, unit, normal range, status. The set of all labs must form a coherent multi-organ pathophysiological story. Include ≥2 values that are mildly abnormal but easy to dismiss, and ≥1 that is near-normal but represents active serious pathology.
• Imaging: 2-3 studies. Each must have multi-sentence detailed findings AND a specific impression. At least 1 study should be non-specific or misleading. Never use vague findings like "no acute findings" alone.
• managementConflicts: always populated. Examples: "Anticoagulation needed for PE vs. active GI bleed", "Aggressive IVF needed for sepsis vs. acute decompensated heart failure", "Steroids needed for inflammatory process vs. active infection requiring immunocompetence"
• underlyingPathology: 6-8 sentences. Describes the complete pathophysiological cascade: how the disease originated, how multi-organ involvement developed, what will happen organ-by-organ if untreated (with timeline), how the comorbidities interact, and which single intervention is most critical.
• correctDiagnosis: state PRIMARY diagnosis + any secondary/contributing diagnosis (e.g., "Thrombotic thrombocytopenic purpura (acquired ADAMTS13 deficiency) precipitated by concurrent Clostridioides difficile infection")
• explanation: 4-5 sentences covering: (1) the discriminating features that confirm this over the top alternatives, (2) the most dangerous management trap, (3) the single action most clinicians miss, (4) the expected outcomes with correct vs. incorrect management.

━━━ REQUIRED JSON FIELDS ━━━
  id                    : unique short id e.g. "case-a1b2c3"
  patientName           : realistic full name (varied ethnicity/background)
  age / gender
  chiefComplaint        : one sentence — the TRIAGE reason for presentation
  historyOfPresentIllness : 4-6 sentences (see above)
  pastMedicalHistory    : string[] — 2-4 comorbidities with durations and relevance to management
  initialAppearance     : vivid 2-sentence bedside impression including affect, skin colour/texture, breathing pattern, posture/position of comfort
  vitals                : { heartRate, bloodPressure, temperature, respiratoryRate, oxygenSaturation, heightCm, weightKg, bmi }
  physicalExam          : { heent, cardiac, respiratory, abdomen, extremities, neurological } — 2-3 sentences each
  labs                  : full array with specific values — NO orderedAt/availableAt at generation time
  imaging               : full array with detailed multi-sentence findings — NO orderedAt/availableAt at generation time
  availableMedications  : { name, route, frequency, category }[] — MINIMUM 30 orderable medications.
                          Include dose in name. Span: analgesics, antibiotics, antihypertensives,
                          anticoagulants, bronchodilators, diuretics, vasopressors, IV fluids,
                          antiemetics, sedatives, electrolytes, steroids, antiarrhythmics.
                          Make them clinically relevant to THIS patient's presentation and comorbidities.
                          Example: {name:"Metoprolol tartrate 25mg",route:"Oral",frequency:"BID",category:"Antihypertensive"}
  availableTests        : {
                            labs:    { name: string; stat: number; routine: number }[],
                            imaging: { name: string; stat: number; routine: number }[]
                          } — comprehensive catalog with AI-declared turnaround times
  medications           : []
  activeAlarms          : [] or populated if vitals are critical
  currentCondition      : one-line clinical status
  physiologicalTrend    : "stable" | "declining"
  simulationTime        : 0
  currentLocation       : ${environment === "prehospital" ? '"Ambulance ALS Unit"' : '"Emergency Department — Resuscitation Bay"'}
  communicationLog      : []
  clinicalActions       : []
  difficulty            : "${difficulty || "resident"}"
  category              : the PRIMARY specialty from: cardiology|pulmonology|neurology|nephrology|gastroenterology|gi_hepatology|endocrinology|hematology_oncology|infectious_disease|sepsis|toxicology|trauma|critical_care|obgyn|psychiatry|rheumatology|vascular_surgery|geriatrics|allergy_immunology|dermatology|urology|orthopaedics|pediatrics
  specialty_tags        : string[] — ALL specialties involved (min 2; match the difficulty contract)
  managementConflicts   : string[] — ALL active competing treatment priorities (NEVER empty)
  requiredConsultations : string[] — ALL subspecialties needed for optimal management
  patientOutcome        : "alive"

  // ANSWER KEY — server-side only, NEVER include in any client response:
  correctDiagnosis      : primary + secondary diagnosis (precise, includes aetiology)
  explanation           : 4-5 sentence teaching point (see above)
  underlyingPathology   : 6-8 sentence full pathophysiological cascade (see above)

Output MUST be valid JSON matching: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Generate the most diagnostically challenging ${difficulty || "resident"}-level case possible — category preference: ${category || "any, but favour under-represented specialties and multi-system presentations"}.

ABSOLUTE REQUIREMENTS:
1. This case must involve multiple specialties. A single-specialty case is unacceptable.
2. The correct diagnosis must not be obvious from the chief complaint — it should require active clinical reasoning.
3. There must be at least one active management conflict that forces a difficult trade-off decision.
4. If a first-year resident could solve this case without consulting a senior, you have failed.
5. Favour: overlap syndromes, rare presentations of common diseases, common presentations of rare diseases, atypical demographics, and situations where the "obvious" answer is dangerously wrong.

Make it genuinely harrowing. This is the case that gets discussed at morning report for a week.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = aiRes.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI");

    const fullCase = JSON.parse(repairJson(content));
    if (!fullCase.id) fullCase.id = `case-${Math.random().toString(36).slice(2, 9)}`;

    // Guarantee required new fields are present even if AI skips them
    if (!Array.isArray(fullCase.specialty_tags))          fullCase.specialty_tags          = [];
    if (!Array.isArray(fullCase.managementConflicts))     fullCase.managementConflicts     = [];
    if (!Array.isArray(fullCase.requiredConsultations))   fullCase.requiredConsultations   = [];
    if (!Array.isArray(fullCase.availableMedications))    fullCase.availableMedications    = [];
    // Coerce legacy string[] availableTests to {name,stat,routine}[]
    if (fullCase.availableTests) {
      for (const key of ["labs", "imaging"] as const) {
        if (Array.isArray(fullCase.availableTests[key])) {
          fullCase.availableTests[key] = fullCase.availableTests[key].map((t: any) =>
            typeof t === "string" ? { name: t, stat: key === "labs" ? 20 : 30, routine: key === "labs" ? 45 : 60 } : t
          );
        }
      }
    }

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
