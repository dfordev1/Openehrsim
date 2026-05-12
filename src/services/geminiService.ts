import * as Sentry from '@sentry/react';
import { CaseEvaluation, MedicalCase } from "../types";

function trimCase(mc: MedicalCase): Partial<MedicalCase> {
  return {
    ...mc,
    clinicalActions:  (mc.clinicalActions  || []).slice(-12),
    communicationLog: (mc.communicationLog || []).slice(-10),
  };
}

async function post<T>(url: string, body: object): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `${url} failed`);
  }
  return res.json();
}

// ── Case generation ──────────────────────────────────────────────────────────

export async function generateMedicalCase(
  difficulty?: string,
  category?: string,
  history?: any[],
  environment?: string
): Promise<MedicalCase> {
  try {
    return await post("/api/generate-case", { difficulty, category, history, environment });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: 'generate-case', difficulty, category } });
    throw err;
  }
}

// ── Intervention / time-advance ──────────────────────────────────────────────

export async function performIntervention(
  intervention: string,
  medicalCase: MedicalCase,
  waitTime = 5
): Promise<MedicalCase> {
  try {
    return await post("/api/perform-intervention", {
      intervention,
      medicalCase: trimCase(medicalCase),
      waitTime,
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { endpoint: 'perform-intervention' },
      extra: { intervention, waitTime, caseId: medicalCase.id },
    });
    throw err;
  }
}

// ── CCS: order a test ────────────────────────────────────────────────────────

export async function orderTest(
  caseId: string,
  testType: "lab" | "imaging",
  testName: string,
  currentSimTime: number,
  priority: "stat" | "routine" = "stat"
): Promise<{ success: boolean; testResult: any; action: any; message: string }> {
  try {
    return await post("/api/order-test", { caseId, testType, testName, currentSimTime, priority });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: 'order-test', testType, testName } });
    throw err;
  }
}

// ── CCS: end case & score ────────────────────────────────────────────────────

export interface EndCasePayload {
  caseId: string;
  medicalCase: Partial<MedicalCase>;
  userNotes?: string;
  // Clinical reasoning data (Healer-style)
  problemRepresentation?: string;
  differentials?: { diagnosis: string; confidence: string; isLead?: boolean }[];
  findingsCount?: number;
  positiveFindings?: string[];
  negativeFindings?: string[];
}

export async function endCase(
  caseId: string,
  medicalCase: MedicalCase,
  userNotes?: string,
  reasoningData?: {
    problemRepresentation: string;
    differentials: { diagnosis: string; confidence: string; isLead?: boolean }[];
    findingsCount: number;
    positiveFindings: string[];
    negativeFindings: string[];
  }
): Promise<CaseEvaluation> {
  try {
    return await post("/api/end-case", {
      caseId,
      medicalCase: trimCase(medicalCase),
      userNotes,
      ...(reasoningData || {}),
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: 'end-case' }, extra: { caseId } });
    throw err;
  }
}

// ── Staff comms ──────────────────────────────────────────────────────────────

export async function staffCall(
  target: string,
  message: string,
  medicalCase: MedicalCase
): Promise<{ reply: string; updatedCase: MedicalCase }> {
  try {
    return await post("/api/staff-call", { target, message, medicalCase: trimCase(medicalCase) });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: 'staff-call', target } });
    throw err;
  }
}

// ── Legacy evaluate-diagnosis (kept for backward-compat) ─────────────────────

export async function evaluateDiagnosis(
  userDiagnosis: string,
  medicalCase: MedicalCase
): Promise<{ score: number; feedback: string }> {
  try {
    return await post("/api/evaluate-diagnosis", {
      userDiagnosis,
      medicalCase: trimCase(medicalCase),
    });
  } catch (err) {
    Sentry.captureException(err, { tags: { endpoint: 'evaluate-diagnosis' } });
    throw err;
  }
}
