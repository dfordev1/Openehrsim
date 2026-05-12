/**
 * CCS-style order endpoint.
 * Looks up the test result from the server-side full case,
 * stamps orderedAt / availableAt, returns to client.
 * Does NOT reveal the result until availableAt <= simulationTime.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCaseServerSide } from "./_supabase.js";
import { TURNAROUND, normaliseTestName } from "../src/utils/normaliseTestName.js";

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  if (!body.caseId || typeof body.caseId !== "string") throw new Error("Missing: caseId");
  if (!["lab", "imaging"].includes(body.testType))      throw new Error("Invalid testType");
  if (!body.testName || typeof body.testName !== "string") throw new Error("Missing: testName");
  if (typeof body.currentSimTime !== "number")          throw new Error("Missing: currentSimTime");
  return {
    caseId:         body.caseId         as string,
    testType:       body.testType       as "lab" | "imaging",
    testName:       body.testName       as string,
    currentSimTime: body.currentSimTime as number,
    priority:       (body.priority === "routine" ? "routine" : "stat") as "stat" | "routine",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { caseId, testType, testName: rawName, currentSimTime, priority } = validateRequest(req.body);

    // Normalise: "Troponin I" → "Troponin", "EKG" → "ECG", "CT Brain" → "CT Head", etc.
    const testName = normaliseTestName(rawName);

    const delays = TURNAROUND[testName];
    if (!delays) {
      return res.status(400).json({
        error: `Unknown test "${rawName}". Available: ${Object.keys(TURNAROUND).join(", ")}`,
      });
    }

    const orderedAt   = currentSimTime;
    const availableAt = currentSimTime + delays[priority];

    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found. Please start a new case." });
    }

    let result: any;
    if (testType === "lab") {
      const match = (fullCase.labs || []).find(
        (l: any) => normaliseTestName(l.name) === testName
      );
      result = match
        ? { ...match, orderedAt, availableAt }
        : { name: rawName, value: "Pending", unit: "", normalRange: "", status: "normal", orderedAt, availableAt };
    } else {
      const match = (fullCase.imaging || []).find(
        (i: any) => normaliseTestName(i.type) === testName
      );
      result = match
        ? { ...match, orderedAt, availableAt }
        : { type: rawName, findings: "Pending read", impression: "Pending", orderedAt, availableAt };
    }

    const action = {
      id:          `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp:   currentSimTime,
      type:        "order",
      description: `Ordered ${testName}${rawName !== testName ? ` (${rawName})` : ""} (${priority.toUpperCase()})`,
      result:      `Results expected at T+${availableAt} min`,
    };

    res.json({ success: true, testResult: result, action, message: `${testName} ordered. Results available at T+${availableAt} min.` });
  } catch (err: any) {
    console.error("order-test error:", err);
    res.status(500).json({ error: err.message || "Failed to order test." });
  }
}
