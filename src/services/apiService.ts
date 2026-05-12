import { MedicalCase } from "../types";

export async function generateMedicalCase(difficulty?: string, category?: string, history?: any[]): Promise<MedicalCase> {
  const response = await fetch("/api/generate-case", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ difficulty, category, history })
  });
  
  if (!response.ok) {
    throw new Error("Failed to generate case from server");
  }
  
  return response.json();
}

export async function evaluateDiagnosis(userDiagnosis: string, medicalCase: MedicalCase): Promise<{ score: number, feedback: string }> {
  const response = await fetch("/api/evaluate-diagnosis", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userDiagnosis, medicalCase })
  });
  
  if (!response.ok) {
    throw new Error("Failed to evaluate diagnosis from server");
  }
  
  return response.json();
}

export async function performIntervention(intervention: string, medicalCase: MedicalCase, waitTime: number = 5): Promise<MedicalCase> {
  const response = await fetch("/api/perform-intervention", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intervention, medicalCase, waitTime })
  });
  
  if (!response.ok) {
    throw new Error("Simulator failed to process intervention.");
  }
  
  return response.json();
}

export async function staffCall(target: string, message: string, medicalCase: MedicalCase): Promise<{ reply: string, updatedCase: MedicalCase }> {
  const response = await fetch("/api/staff-call", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, message, medicalCase })
  });
  
  if (!response.ok) {
    throw new Error("Communication line disrupted.");
  }
  
  return response.json();
}
