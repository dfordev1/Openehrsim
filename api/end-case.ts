/**
 * CCS case-completion & combined management + reasoning scoring endpoint.
 *
 * Retrieves the hidden correctDiagnosis from Supabase, scores BOTH the
 * user's management AND their clinical reasoning (Healer-style), persists
 * the result, and deletes the active case.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { getCaseServerSide, deleteCaseServerSide, getServerSupabase } from "./_supabase.js";

interface DifferentialInput {
  diagnosis: string;
  confidence: string;
  isLead?: boolean;
}

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  if (!body.caseId || typeof body.caseId !== "string") throw new Error("Missing: caseId");
  if (!body.medicalCase || typeof body.medicalCase !== "object") throw new Error("Missing: medicalCase");

  // Clinical-reasoning payload is optional, but if present must be well-formed.
  const rawDifferentials = body.differentials;
  const differentials: DifferentialInput[] = Array.isArray(rawDifferentials)
    ? rawDifferentials
        .filter((d: any) => d && typeof d.diagnosis === "string")
        .slice(0, 20)
        .map((d: any) => ({
          diagnosis: String(d.diagnosis).slice(0, 200),
          confidence: typeof d.confidence === "string" ? d.confidence : "moderate",
          isLead: Boolean(d.isLead),
        }))
    : [];

  const positiveFindings: string[] = Array.isArray(body.positiveFindings)
    ? body.positiveFindings.filter((s: any) => typeof s === "string").slice(0, 40)
    : [];
  const negativeFindings: string[] = Array.isArray(body.negativeFindings)
    ? body.negativeFindings.filter((s: any) => typeof s === "string").slice(0, 40)
    : [];

  return {
    caseId:                body.caseId                as string,
    medicalCase:           body.medicalCase           as any,
    userNotes:             typeof body.userNotes === "string" ? body.userNotes.slice(0, 2000) : undefined,
    problemRepresentation: typeof body.problemRepresentation === "string"
      ? body.problemRepresentation.slice(0, 2000)
      : "",
    differentials,
    findingsCount:         typeof body.findingsCount === "number" ? body.findingsCount : 0,
    positiveFindings,
    negativeFindings,
  };
}

function trimCase(mc: any) {
  return {
    ...mc,
    clinicalActions:  (mc.clinicalActions  || []).slice(-20),
    communicationLog: (mc.communicationLog || []).slice(-10),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const {
      caseId,
      medicalCase,
      userNotes,
      problemRepresentation,
      differentials,
      findingsCount,
      positiveFindings,
      negativeFindings,
    } = validateRequest(req.body);

    // ── Fetch answer key ──────────────────────────────────────────────────────
    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found or already scored." });
    }

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_"))
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });

    const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });

    const trimmed = trimCase(medicalCase);

    const actionLog = (trimmed.clinicalActions || [])
      .map((a: any) => `T+${a.timestamp}: [${a.type}] ${a.description}`)
      .join("\n") || "No actions recorded.";

    const medLog = (trimmed.medications || [])
      .map((m: any) => `T+${m.timestamp}: ${m.name} ${m.dose} ${m.route}`)
      .join("\n") || "No medications administered.";

    const labsOrdered = (trimmed.labs || [])
      .map((l: any) => `${l.name} (ordered T+${l.orderedAt ?? "?"})`)
      .join(", ") || "None";

    const imagingOrdered = (trimmed.imaging || [])
      .map((i: any) => `${i.type} (ordered T+${i.orderedAt ?? "?"})`)
      .join(", ") || "None";

    const hasReasoning =
      problemRepresentation.trim().length > 0 ||
      differentials.length > 0 ||
      findingsCount > 0;

    const reasoningContext = hasReasoning
      ? `

CLINICAL REASONING DATA (Healer-style — score this rigorously):
  Problem Representation: "${problemRepresentation || "Not provided"}"
  Differential Diagnoses: ${
    differentials.length > 0
      ? differentials
          .map(d => `${d.diagnosis} (${d.confidence}${d.isLead ? ", LEAD" : ""})`)
          .join("; ")
      : "None submitted"
  }
  Lead Diagnosis Submitted: ${
    differentials.find(d => d.isLead)?.diagnosis || "None marked as lead"
  }
  Findings Tracked: ${findingsCount}
  Pertinent Positives: ${positiveFindings.join(", ") || "None identified"}
  Pertinent Negatives: ${negativeFindings.join(", ") || "None identified"}`
      : `

CLINICAL REASONING DATA: User submitted no structured reasoning.
Score reasoning dimensions LOW (≤40) — absence of reasoning is itself a deficit.`;

    const aiRes = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a clinical reasoning assessor combining USMLE Step 3 CCS scoring with Healer-style clinical reasoning evaluation.

ANSWER KEY (never reveal verbatim in feedback to the learner):
  Correct Diagnosis: ${fullCase.correctDiagnosis}
  Explanation: ${fullCase.explanation || ""}

SCORING (100 pts total — 2 dimensions):

A) MANAGEMENT QUALITY (60 pts):
  initialManagement (0-15): Appropriate initial orders, acuity recognition
  diagnosticWorkup (0-15): Right tests at right time, avoided waste
  therapeuticInterventions (0-20): Correct treatment, timing, doses/routes
  patientOutcome (0-10): Final status (alive+improving=10, stable=6, critical=3, deceased=0)

B) CLINICAL REASONING QUALITY (40 pts) — MUST be graded from the Clinical Reasoning Data section:
  dataAcquisitionThoroughness (0-10): Pertinent findings gathered (positives + negatives)
  dataAcquisitionEfficiency   (0-10): Focused history/workup, not shotgun
  problemRepresentation       (0-10): One-liner quality — demographics, timeline, discriminating features, syndrome framing
  differentialAccuracy        (0-10): Breadth AND specificity of DDx; lead diagnosis alignment with correct diagnosis

EFFICIENCY PENALTIES (subtract from total): >5 unnecessary tests: -5; Key intervention >30 min late: -5

IMPORTANT:
- If the user submitted NO problem representation OR NO differentials, their reasoning sub-scores MUST be low (≤4/10 each).
- The final "score" field is management (60) + reasoning (40) + efficiencyPenalty (≤0), clamped to 0-100.
- "reasoningScore" fields are reported on a 0-100 scale (multiply the 0-10 rubric by 10 for display).
- Never paste the correct diagnosis into "feedback"; put it only in "correctDiagnosis".

Return JSON ONLY:
{
  "score": number (0-100),
  "breakdown": {
    "initialManagement": number,
    "diagnosticWorkup": number,
    "therapeuticInterventions": number,
    "patientOutcome": number,
    "efficiencyPenalty": number
  },
  "reasoningScore": {
    "dataAcquisitionThoroughness": number,
    "dataAcquisitionEfficiency": number,
    "problemRepresentation": number,
    "differentialAccuracy": number,
    "finalLeadDiagnosis": number,
    "managementPlan": number,
    "overall": number
  },
  "feedback": "3-4 sentence narrative covering BOTH management AND reasoning quality",
  "correctDiagnosis": "${fullCase.correctDiagnosis}",
  "explanation": "brief teaching point (do NOT repeat the diagnosis name)",
  "keyActions": ["✓ or ✗ + description", ...],
  "criticalMissed": ["missed or delayed critical action", ...],
  "clinicalPearl": "one memorable teaching point from this case"
}`,
        },
        {
          role: "user",
          content: `CASE: ${trimmed.chiefComplaint} | ${trimmed.age}y ${trimmed.gender}
INITIAL VITALS: HR ${trimmed.vitals?.heartRate}, BP ${trimmed.vitals?.bloodPressure}, RR ${trimmed.vitals?.respiratoryRate}, SpO2 ${trimmed.vitals?.oxygenSaturation}%, Temp ${trimmed.vitals?.temperature}°C

LABS ORDERED: ${labsOrdered}
IMAGING ORDERED: ${imagingOrdered}

ACTIONS:
${actionLog}

MEDICATIONS:
${medLog}

FINAL STATE: T+${trimmed.simulationTime} min | Outcome: ${trimmed.patientOutcome || "alive"} | Trend: ${trimmed.physiologicalTrend}
FINAL VITALS: HR ${trimmed.vitals?.heartRate}, BP ${trimmed.vitals?.bloodPressure}, SpO2 ${trimmed.vitals?.oxygenSaturation}%

USER NOTES: ${userNotes || "none"}${reasoningContext}`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = aiRes.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI evaluator");

    const evaluation = JSON.parse(content);

    // ── Persist result to simulation_results table ────────────────────────────
    const db = getServerSupabase();
    let savedToDb = false;
    if (db) {
      // Extract user_id — try network verification first, fall back to local JWT decode.
      // Local decode is reliable enough for this write path (service role controls the insert).
      let userId: string | null = null;
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
          const { data: { user } } = await (db as any).auth.getUser(token);
          userId = user?.id ?? null;
        } catch { /* fall through to local decode */ }
        if (!userId) {
          try {
            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
            userId = payload.sub ?? null;
          } catch { /* give up */ }
        }
      }
      if (!userId) console.warn('end-case: could not resolve user_id — result saved anonymously');

      // Build payload; include reasoning_score only if the column exists in the
      // user's schema — if not, we retry without it so an unmigrated DB doesn't
      // silently lose the whole row.
      const basePayload: Record<string, any> = {
        case_id:              caseId,
        user_id:              userId,
        patient_name:         trimmed.patientName,
        age:                  trimmed.age,
        category:             trimmed.category,
        difficulty:           trimmed.difficulty,
        user_diagnosis:       userNotes || null,
        correct_diagnosis:    fullCase.correctDiagnosis,
        score:                evaluation.score,
        feedback:             evaluation.feedback,
        simulation_time:      trimmed.simulationTime,
        clinical_actions:     trimmed.clinicalActions,
        medications:          trimmed.medications,
        management_breakdown: evaluation.breakdown,
        key_actions:          evaluation.keyActions,
        clinical_pearl:       evaluation.clinicalPearl,
      };

      const withReasoning = {
        ...basePayload,
        reasoning_score:        evaluation.reasoningScore ?? null,
        problem_representation: problemRepresentation || null,
        differentials:          differentials.length > 0 ? differentials : null,
      };

      const first = await (db as any).from("simulation_results").insert([withReasoning]);
      if (first.error) {
        // Fallback if the reasoning columns haven't been migrated yet.
        const retry = await (db as any).from("simulation_results").insert([basePayload]);
        if (retry.error) console.error("Could not save result:", retry.error.message);
        else { savedToDb = true; console.warn("Saved result without reasoning columns — run SUPABASE_SETUP.md migration."); }
      } else {
        savedToDb = true;
      }
    }

    // ── Clean up active case ──────────────────────────────────────────────────
    await deleteCaseServerSide(caseId);

    res.json({
      ...evaluation,
      caseId,
      totalSimulationTime: trimmed.simulationTime,
      savedToDb,
    });
  } catch (err: any) {
    console.error("end-case error:", err);
    res.status(500).json({ error: err.message || "Failed to score case." });
  }
}
