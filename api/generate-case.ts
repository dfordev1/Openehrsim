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
          content: `You are a high-fidelity USMLE Step 3 CCS simulation engine.
Generate a COMPLETE case including the hidden answer key.

DIFFICULTY:
- intern:    Classic, textbook presentations (STEMI, uncomplicated Sepsis, DKA).
- resident:  Mixed clues, moderate complexity (PE vs pneumonia, HHS, ACS vs GERD).
- attending: Subtle / rare / diagnostic dilemmas (Thyroid Storm, Serotonin Syndrome, occult haemorrhage).

${envCtx}
${historyCtx}

REQUIRED FIELDS — include ALL of them:
  id                  : unique short id e.g. "case-a1b2c3"
  patientName         : realistic full name
  age / gender
  chiefComplaint      : one sentence
  historyOfPresentIllness : 2-3 sentences MAX — what triage / EMS knows
  pastMedicalHistory  : string[]
  initialAppearance   : vivid 1-sentence bedside impression ("Pale, diaphoretic, clutching chest")
  vitals              : { heartRate, bloodPressure, temperature, respiratoryRate, oxygenSaturation }
  physicalExam        : { heent, cardiac, respiratory, abdomen, extremities, neurological }
  labs                : FULL array of relevant labs WITH values — but NO orderedAt/availableAt yet
  imaging             : FULL array WITH findings/impression — but NO orderedAt/availableAt yet
  availableTests      : { labs: string[], imaging: string[] }  — catalog the user can order from
  medications         : []   (none given yet)
  activeAlarms        : []   (or add if vitals are critical)
  currentCondition    : one-line clinical status
  physiologicalTrend  : "stable" | "declining"
  simulationTime      : 0
  currentLocation     : ${environment === "prehospital" ? '"Ambulance Rescue 1"' : '"Emergency Room (ER) Bay 1"'}
  communicationLog    : []
  clinicalActions     : []
  difficulty          : "${difficulty || "resident"}"
  category            : one of cardiology|pulmonology|sepsis|trauma|neurology|toxicology
  patientOutcome      : "alive"

  // ANSWER KEY — server-side only, never sent to client:
  correctDiagnosis    : full diagnosis string
  explanation         : 2-3 sentence teaching point
  underlyingPathology : detailed pathophysiology used to evolve patient realistically

Output MUST be valid JSON matching: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Generate a ${difficulty || "resident"}-level case — category: ${category || "any"}.`,
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
