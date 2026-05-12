import { MedicalCase, ConsultantAdvice } from "../types";

/**
 * Calls the server-side /api/consult route (Gemini gemini-2.0-flash-lite).
 * Keeping AI calls server-side protects the API key from browser exposure.
 */
export async function getConsultantAdvice(medicalCase: MedicalCase): Promise<ConsultantAdvice> {
  const response = await fetch("/api/consult", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ medicalCase }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || "Consultant is currently unavailable.");
  }

  return response.json();
}
