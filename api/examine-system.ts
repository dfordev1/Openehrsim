/**
 * CCS-style examine-system endpoint.
 *
 * The client only has "Not yet examined" for each physicalExam field.
 * When the user clicks Examine, this endpoint fetches the real finding
 * from the server-side full case (Supabase / in-memory fallback).
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCaseServerSide } from "./_supabase.js";
import { LOCKED_SENTINEL } from "../src/lib/constants.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { caseId, system } = req.body ?? {};

    if (!caseId || typeof caseId !== "string") {
      return res.status(400).json({ error: "Missing: caseId" });
    }
    if (!system || typeof system !== "string") {
      return res.status(400).json({ error: "Missing: system" });
    }

    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found. Please start a new case." });
    }

    // Check against actual case keys instead of a hardcoded list
    const examKeys = Object.keys(fullCase.physicalExam || {});
    const finding = fullCase.physicalExam?.[system];

    if (!finding || finding === LOCKED_SENTINEL) {
      // Try case-insensitive match
      const match = examKeys.find(k => k.toLowerCase() === system.toLowerCase());
      if (match && fullCase.physicalExam[match] && fullCase.physicalExam[match] !== LOCKED_SENTINEL) {
        return res.json({ system: match, finding: fullCase.physicalExam[match] });
      }
      return res.json({ system, finding: "Examination performed — findings within normal limits." });
    }

    res.json({ system, finding });
  } catch (err: any) {
    console.error("examine-system error:", err);
    res.status(500).json({ error: err.message || "Failed to retrieve examination finding." });
  }
}
