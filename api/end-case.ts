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
          content: `You are the chief evaluator for the world's most demanding clinical simulation platform — equivalent to a full M&M conference at a top academic medical centre. Score with rigorous, unsparing, subspecialty-level standards.

ANSWER KEY (never reveal verbatim in feedback — guide discovery):
  Correct Diagnosis: ${fullCase.correctDiagnosis}
  Explanation: ${fullCase.explanation || ""}

This was a complex, multi-specialty case. A learner who treated it as single-specialty should be penalised across both dimensions.

SCORING (100 pts total):

A) MANAGEMENT QUALITY (60 pts):
  initialManagement (0-15):
    13-15: Immediate acuity recognition, correct resuscitation, right initial prioritisation across specialties
    9-12: Correct initial orders but missed ≥1 time-critical element or misordered priorities
    5-8: Partial — treated obvious findings, missed multi-system nature
    0-4: Wrong initial management, dangerous orders, or critical delay

  diagnosticWorkup (0-15):
    13-15: Right tests in right sequence; identified the pivotal discriminating test; avoided waste
    9-12: Appropriate but delayed or included unnecessary workup
    5-8: Shotgun approach — everything ordered, pivotal test missed or late
    0-4: Critical tests missed; wrong tests delayed diagnosis

  therapeuticInterventions (0-20):
    17-20: Correct treatment of primary AND secondary pathology; navigated management conflicts correctly; appropriate doses/routes/timing
    12-16: Primary condition treated correctly; missed secondary pathology or complications
    6-11: Partial treatment or failed ≥1 management conflict
    0-5: Wrong treatment, dangerous drug interactions, or untreated critical components

  patientOutcome (0-10): alive+improving=10, alive+stable=6, alive+critical=3, critical_deterioration=1, deceased=0

B) CLINICAL REASONING (40 pts — grade from reasoning data below):
  dataAcquisitionThoroughness (0-10): Pertinent positives AND negatives; cross-specialty findings
  dataAcquisitionEfficiency   (0-10): Hypothesis-driven vs. unfocused; targeted test ordering
  problemRepresentation       (0-10): One-liner capturing demographics, timeline, discriminating features, multi-system syndrome
  differentialAccuracy        (0-10): Correct specialties represented; non-obvious diagnosis on list; lead diagnosis correct

EFFICIENCY PENALTIES:
  • >7 unnecessary tests: -5
  • Time-critical intervention >30 min late: -5
  • Dangerous medication order (contraindicated, lethal interaction, wrong dose): -10

GRADING STANDARDS (be rigorous — inflate = useless feedback):
  90-100: Subspecialist-level. Extremely rare.
  75-89: Competent attending. Managed primary + secondary; good reasoning.
  55-74: Resident-level. Managed the obvious; missed multi-specialty complexity.
  35-54: Intern-level. Recognised acute problem; failed to integrate full picture.
  <35: Dangerous. Critical elements missed; management would cause harm.

RULES:
- No PR or differentials submitted → reasoning sub-scores ≤4/10 each.
- Correct diagnosis never on differential → differentialAccuracy ≤3/10.
- score = management (60) + reasoning (40) + penalties (≤0), clamped 0-100.
- reasoningScore fields reported 0-100 (multiply rubric by 10).
- NEVER paste correct diagnosis into feedback — it goes only in correctDiagnosis.
- feedback must address management AND reasoning in 4-5 sentences.
- criticalMissed must be specific and actionable.

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
  "feedback": "4-5 sentences: what was done well, the multi-specialty element missed, the management trap, and the key take-away",
  "correctDiagnosis": "${fullCase.correctDiagnosis}",
  "explanation": "2-3 sentences on WHY this diagnosis over the most plausible alternatives",
  "keyActions": ["✓ or ✗ + specific action with clinical consequence", ...],
  "criticalMissed": ["specific missed/delayed action and its consequence", ...],
  "clinicalPearl": "one unforgettable teaching point about the multi-specialty or diagnostic complexity of this case"
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
