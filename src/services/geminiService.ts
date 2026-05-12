import { MedicalCase } from "../types";

/**
 * Trim a MedicalCase before sending to the server to prevent payload bloat.
 * Keeps only the last 10 clinicalActions and communicationLog entries.
 */
function trimCase(mc: MedicalCase): MedicalCase {
  return {
    ...mc,
    clinicalActions: (mc.clinicalActions || []).slice(-10),
    communicationLog: (mc.communicationLog || []).slice(-10),
  };
}

export async function generateMedicalCase(
  difficulty?: string,
  category?: string,
  history?: any[],
  environment?: string
): Promise<MedicalCase> {
  const response = await fetch("/api/generate-case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty, category, history, environment }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to generate case from server");
  }

  return response.json();
}

export async function evaluateDiagnosis(
  userDiagnosis: string,
  medicalCase: MedicalCase
): Promise<{ score: number; feedback: string }> {
  const response = await fetch("/api/evaluate-diagnosis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userDiagnosis, medicalCase: trimCase(medicalCase) }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Failed to evaluate diagnosis from server");
  }

  return response.json();
}

export async function performIntervention(
  intervention: string,
  medicalCase: MedicalCase,
  waitTime: number = 5
): Promise<MedicalCase> {
  const response = await fetch("/api/perform-intervention", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intervention, medicalCase: trimCase(medicalCase), waitTime }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Simulator failed to process intervention.");
  }

  return response.json();
}

export async function staffCall(
  target: string,
  message: string,
  medicalCase: MedicalCase
): Promise<{ reply: string; updatedCase: MedicalCase }> {
  const response = await fetch("/api/staff-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, message, medicalCase: trimCase(medicalCase) }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Communication line disrupted.");
  }

  return response.json();
}
