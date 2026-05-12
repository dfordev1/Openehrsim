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
  return post("/api/generate-case", { difficulty, category, history, environment });
}

// ── Intervention / time-advance ──────────────────────────────────────────────

export async function performIntervention(
  intervention: string,
  medicalCase: MedicalCase,
  waitTime = 5
): Promise<MedicalCase> {
  return post("/api/perform-intervention", {
    intervention,
    medicalCase: trimCase(medicalCase),
    waitTime,
  });
}

// ── CCS: order a test ────────────────────────────────────────────────────────

export async function orderTest(
  caseId: string,
  testType: "lab" | "imaging",
  testName: string,
  currentSimTime: number,
  priority: "stat" | "routine" = "stat"
): Promise<{ success: boolean; testResult: any; action: any; message: string }> {
  return post("/api/order-test", { caseId, testType, testName, currentSimTime, priority });
}

// ── CCS: end case & score ────────────────────────────────────────────────────

export async function endCase(
  caseId: string,
  medicalCase: MedicalCase,
  userNotes?: string
): Promise<CaseEvaluation> {
  return post("/api/end-case", {
    caseId,
    medicalCase: trimCase(medicalCase),
    userNotes,
  });
}

// ── Staff comms ──────────────────────────────────────────────────────────────

export async function staffCall(
  target: string,
  message: string,
  medicalCase: MedicalCase
): Promise<{ reply: string; updatedCase: MedicalCase }> {
  return post("/api/staff-call", { target, message, medicalCase: trimCase(medicalCase) });
}

// ── Legacy evaluate-diagnosis (kept for backward-compat) ─────────────────────

export async function evaluateDiagnosis(
  userDiagnosis: string,
  medicalCase: MedicalCase
): Promise<{ score: number; feedback: string }> {
  return post("/api/evaluate-diagnosis", {
    userDiagnosis,
    medicalCase: trimCase(medicalCase),
  });
}
