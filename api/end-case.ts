/**
 * CCS case-completion & management-based scoring endpoint.
 *
 * Retrieves the hidden correctDiagnosis from Supabase,
 * scores the user's management + clinical reasoning quality,
 * persists results, and deletes the active case.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { getCaseServerSide, deleteCaseServerSide, getServerSupabase } from "./_supabase.js";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  if (!body.caseId || typeof body.caseId !== "string") throw new Error("Missing: caseId");
  if (!body.medicalCase || typeof body.medicalCase !== "object") throw new Error("Missing: medicalCase");
  return {
    caseId:                 body.caseId                 as string,
    medicalCase:            body.medicalCase            as any,
    userNotes:              body.userNotes              as string | undefined,
    problemRepresentation:  body.problemRepresentation  as string | undefined,
    differentials:          body.differentials          as any[] | undefined,
    findingsCount:          body.findingsCount          as number | undefined,
    positiveFindings:       body.positiveFindings       as string[] | undefined,
    negativeFindings:       body.negativeFindings       as string[] | undefined,
    prHistory:              body.prHistory              as any[] | undefined,
    stageCommitments:       body.stageCommitments       as any[] | undefined,
    findingsByDx:           body.findingsByDx           as any[] | undefined,
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
      prHistory,
      stageCommitments,
      findingsByDx,
    } = validateRequest(req.body);

    // ── Fetch answer key ──────────────────────────────────────────────────────
    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found or already scored." });
    }

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_"))
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured." });

    const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com" });

    const actionLog = (medicalCase.clinicalActions || [])
      .map((a: any) => `T+${a.timestamp}: [${a.type}] ${a.description}`)
      .join("\n") || "No actions recorded.";

    const medLog = (medicalCase.medications || [])
      .map((m: any) => `T+${m.timestamp}: ${m.name} ${m.dose} ${m.route}`)
      .join("\n") || "No medications administered.";

    const labsOrdered = (medicalCase.labs || [])
      .map((l: any) => `${l.name} (ordered T+${l.orderedAt ?? "?"})`)
      .join(", ") || "None";

    const imagingOrdered = (medicalCase.imaging || [])
      .map((i: any) => `${i.type} (ordered T+${i.orderedAt ?? "?"})`)
      .join(", ") || "None";

    // ── Clinical reasoning context (Healer-style) ──────────────────────
    const differentialsList = (differentials || []).map((d: any) => {
      const base = `${d.diagnosis} (${d.confidence}${d.isLead ? ', LEAD' : ''})`;
      if (!d.illnessScript) return base;
      const is = d.illnessScript;
      const scriptBits = [
        is.typicalDemographics && `demo: ${is.typicalDemographics}`,
        is.typicalTimeline && `timeline: ${is.typicalTimeline}`,
        (is.keyFeatures || []).length > 0 && `key: [${is.keyFeatures.join('; ')}]`,
        (is.discriminatingFeatures || []).length > 0 && `discriminating: [${is.discriminatingFeatures.join('; ')}]`,
        (is.expectedLabs || []).length > 0 && `expected labs: [${is.expectedLabs.join('; ')}]`,
      ].filter(Boolean).join(' | ');
      return `${base} — script: ${scriptBits}`;
    });

    const prEvolution = (prHistory || [])
      .map((s: any, i: number) => `  v${i + 1} @ ${s.stage} (T+${s.simTime}m): "${s.text}"`)
      .join('\n');

    const commitLog = (stageCommitments || [])
      .map((c: any) => `  ${c.stage} @ T+${c.simTime}m — ${c.differentialCount} ddx${c.leadDiagnosis ? `, lead: ${c.leadDiagnosis}` : ''}`)
      .join('\n');

    const findingsByDxBlock = (findingsByDx || [])
      .map((f: any) => {
        const assignments = Object.entries(f.relevanceByDx || {})
          .map(([dxId, r]) => {
            const dx = (differentials || []).find((d: any) => d.id === dxId) || {};
            return `${dx.diagnosis || dxId}=${r}`;
          })
          .join(', ');
        return `  [${f.source}] "${f.findingText}" → ${assignments}`;
      })
      .join('\n');

    const reasoningContext =
      problemRepresentation || differentials || prHistory || stageCommitments
        ? `
CLINICAL REASONING DATA:
  Final Problem Representation: "${problemRepresentation || 'Not provided'}"
  Differentials with illness scripts:
${differentialsList.length ? differentialsList.map((s: string) => `    - ${s}`).join('\n') : '    (none)'}
  Findings tracked: ${findingsCount || 0}
  Pertinent Positives: ${(positiveFindings || []).join(', ') || 'None'}
  Pertinent Negatives: ${(negativeFindings || []).join(', ') || 'None'}
${prEvolution ? `  PR evolution across stages:\n${prEvolution}\n` : ''}${commitLog ? `  Stage commitments:\n${commitLog}\n` : ''}${findingsByDxBlock ? `  Findings linked to specific differentials:\n${findingsByDxBlock}\n` : ''}`
        : '';

    const aiRes = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a clinical reasoning assessor combining USMLE Step 3 CCS scoring with Healer-style clinical reasoning evaluation.

ANSWER KEY:
  Correct Diagnosis: ${fullCase.correctDiagnosis}
  Explanation: ${fullCase.explanation || ""}

SCORING (100 pts total — 2 dimensions):

A) MANAGEMENT QUALITY (60 pts):
  initialManagement (0-15): Appropriate initial orders, acuity recognition
  diagnosticWorkup (0-15): Right tests at right time, efficiency
  therapeuticInterventions (0-20): Correct treatment, timing, doses
  patientOutcome (0-10): Patient status at end

B) CLINICAL REASONING QUALITY (40 pts):
  dataAcquisitionThoroughness (0-10): How many pertinent findings were gathered
  dataAcquisitionEfficiency (0-10): How focused was data gathering (few irrelevant tests)
  problemRepresentation (0-10): Quality of PR — includes key demographics, timeline, discriminating features.
    BONUS: If PR evolved across stages (multiple snapshots with increasing
    specificity), score higher. Premature finalization or a PR that never
    changes should score lower.
  differentialAccuracy (0-10): Lead diagnosis correct? Differential reasonable?
    BONUS: Credit breadth early (>=3 dxs at triage/history) and
    convergence late (narrowed to 1-3 with a committed lead by dxpause).
    If illness scripts were recorded for the lead, score higher.
    If findings were linked to specific differentials as pertinent +/-,
    score higher.

EFFICIENCY PENALTIES (subtract from total): >5 unnecessary tests: -5, Key intervention >30 min late: -5

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
    "dataAcquisitionThoroughness": number (0-100 scale),
    "dataAcquisitionEfficiency": number (0-100 scale),
    "problemRepresentation": number (0-100 scale),
    "differentialAccuracy": number (0-100 scale),
    "finalLeadDiagnosis": number (0-100 scale),
    "managementPlan": number (0-100 scale),
    "overall": number (0-100 scale)
  },
  "feedback": "3-4 sentence narrative covering both management AND reasoning quality. If the PR evolved, comment on how it evolved. If illness scripts were written, comment on their accuracy.",
  "correctDiagnosis": "${fullCase.correctDiagnosis}",
  "explanation": "brief teaching point",
  "keyActions": ["description", ...],
  "criticalMissed": ["missed action", ...],
  "clinicalPearl": "one memorable teaching point"
}`,
        },
        {
          role: "user",
          content: `CASE: ${medicalCase.chiefComplaint} | ${medicalCase.age}y ${medicalCase.gender}
INITIAL VITALS: HR ${medicalCase.vitals?.heartRate}, BP ${medicalCase.vitals?.bloodPressure}, RR ${medicalCase.vitals?.respiratoryRate}, SpO2 ${medicalCase.vitals?.oxygenSaturation}%, Temp ${medicalCase.vitals?.temperature}°C

LABS ORDERED: ${labsOrdered}
IMAGING ORDERED: ${imagingOrdered}

ACTIONS:
${actionLog}

MEDICATIONS:
${medLog}

FINAL STATE: T+${medicalCase.simulationTime} min | Outcome: ${medicalCase.patientOutcome || "alive"} | Trend: ${medicalCase.physiologicalTrend}
FINAL VITALS: HR ${medicalCase.vitals?.heartRate}, BP ${medicalCase.vitals?.bloodPressure}, SpO2 ${medicalCase.vitals?.oxygenSaturation}%

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
    if (db) {
      const { error: saveErr } = await (db as any).from("simulation_results").insert([{
        case_id:              caseId,
        patient_name:         medicalCase.patientName,
        age:                  medicalCase.age,
        category:             medicalCase.category,
        difficulty:           medicalCase.difficulty,
        user_diagnosis:       userNotes || null,
        correct_diagnosis:    fullCase.correctDiagnosis,
        score:                evaluation.score,
        feedback:             evaluation.feedback,
        simulation_time:      medicalCase.simulationTime,
        clinical_actions:     medicalCase.clinicalActions,
        medications:          medicalCase.medications,
        management_breakdown: evaluation.breakdown,
        key_actions:          evaluation.keyActions,
        clinical_pearl:       evaluation.clinicalPearl,
      }]);
      if (saveErr) console.warn("Could not save result:", saveErr.message);
    }

    // ── Clean up active case ──────────────────────────────────────────────────
    await deleteCaseServerSide(caseId);

    res.json({
      ...evaluation,
      caseId,
      totalSimulationTime: medicalCase.simulationTime,
    });
  } catch (err: any) {
    console.error("end-case error:", err);
    res.status(500).json({ error: err.message || "Failed to score case." });
  }
}
