/**
 * CCS-style examine-system endpoint.
 *
 * The client only has "Not yet examined" for each physicalExam field.
 * When the user clicks Examine, this endpoint fetches the real finding
 * from the server-side full case (Supabase / in-memory fallback).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCaseServerSide } from "./_supabase.js";

const SYSTEM_KEYS = ['heent', 'cardiac', 'respiratory', 'abdomen', 'extremities', 'neurological'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { caseId, system } = req.body ?? {};

    if (!caseId || typeof caseId !== "string") {
      return res.status(400).json({ error: "Missing: caseId" });
    }
    if (!system || !SYSTEM_KEYS.includes(system)) {
      return res.status(400).json({ error: `Invalid system. Must be one of: ${SYSTEM_KEYS.join(", ")}` });
    }

    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found. Please start a new case." });
    }

    const finding = fullCase.physicalExam?.[system];

    if (!finding || finding === "Not yet examined") {
      return res.status(404).json({ error: `No finding for system "${system}" in this case.` });
    }

    res.json({ system, finding });
  } catch (err: any) {
    console.error("examine-system error:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve examination finding." });
  }
}
