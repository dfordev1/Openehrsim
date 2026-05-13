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

    // Use known turnaround if available, otherwise use sensible defaults
    const delays = TURNAROUND[testName] || (testType === "lab"
      ? { stat: 20, routine: 45 }
      : { stat: 30, routine: 60 });

    const orderedAt   = currentSimTime;
    const availableAt = currentSimTime + delays[priority];

    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found. Please start a new case." });
    }

    let result: any;
    if (testType === "lab") {
      // Try exact match first, then fuzzy match by checking if names contain each other
      const match = (fullCase.labs || []).find(
        (l: any) => normaliseTestName(l.name) === testName
      ) || (fullCase.labs || []).find(
        (l: any) => l.name.toLowerCase().includes(testName.toLowerCase()) ||
                    testName.toLowerCase().includes(l.name.toLowerCase())
      );
      result = match
        ? { ...match, orderedAt, availableAt }
        : { name: rawName, value: "Pending", unit: "", normalRange: "", status: "normal", orderedAt, availableAt };
    } else {
      const match = (fullCase.imaging || []).find(
        (i: any) => normaliseTestName(i.type) === testName
      ) || (fullCase.imaging || []).find(
        (i: any) => i.type.toLowerCase().includes(testName.toLowerCase()) ||
                    testName.toLowerCase().includes(i.type.toLowerCase())
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
