/**
 * CCS-style order endpoint.
 * Looks up the test result from the server-side full case,
 * stamps orderedAt / availableAt, returns to client.
 * Does NOT reveal the result until availableAt <= simulationTime.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCaseServerSide } from "./_supabase.js";

// Stat turnaround times in minutes (realistic ER estimates)
const TURNAROUND: Record<string, { stat: number; routine: number }> = {
  // Labs
  "CBC":                { stat: 15, routine: 30 },
  "BMP":                { stat: 15, routine: 30 },
  "CMP":                { stat: 20, routine: 45 },
  "Troponin":           { stat: 20, routine: 45 },
  "Lactate":            { stat: 10, routine: 20 },
  "Blood Culture":      { stat: 30, routine: 60 },
  "ABG":                { stat:  5, routine: 15 },
  "Coagulation Panel":  { stat: 20, routine: 40 },
  "LFTs":               { stat: 20, routine: 45 },
  "Lipase":             { stat: 20, routine: 45 },
  "Urinalysis":         { stat: 15, routine: 30 },
  "Drug Screen":        { stat: 30, routine: 60 },
  "TSH":                { stat: 30, routine: 60 },
  "Procalcitonin":      { stat: 25, routine: 50 },
  "D-Dimer":            { stat: 20, routine: 40 },
  "BNP":                { stat: 20, routine: 40 },
  // Imaging
  "ECG":                { stat:  5, routine: 10 },
  "Chest X-ray":        { stat: 20, routine: 45 },
  "CT Head":            { stat: 30, routine: 60 },
  "CT Chest":           { stat: 30, routine: 60 },
  "CT Abdomen/Pelvis":  { stat: 35, routine: 70 },
  "CT PE Protocol":     { stat: 35, routine: 70 },
  "Ultrasound":         { stat: 25, routine: 50 },
  "Echocardiogram":     { stat: 30, routine: 60 },
  "MRI Brain":          { stat: 45, routine: 90 },
};

/**
 * AI models sometimes generate test name variants (e.g. "Troponin I", "Trop I",
 * "PT/INR", "Chest XR", "EKG"). This map normalises them to the canonical keys
 * in TURNAROUND so ordering never fails due to a naming mismatch.
 */
const ALIASES: Record<string, string> = {
  // Troponin variants
  "troponin i":               "Troponin",
  "troponin t":               "Troponin",
  "trop i":                   "Troponin",
  "trop t":                   "Troponin",
  "high-sensitivity troponin":"Troponin",
  "hs-troponin":              "Troponin",
  "hs troponin":              "Troponin",
  "cardiac troponin":         "Troponin",
  // BMP / CMP variants
  "basic metabolic panel":    "BMP",
  "comprehensive metabolic":  "CMP",
  "comprehensive metabolic panel": "CMP",
  "chem 7":                   "BMP",
  "chem7":                    "BMP",
  // CBC variants
  "complete blood count":     "CBC",
  "complete blood cell count":"CBC",
  // Coagulation
  "coagulation":              "Coagulation Panel",
  "pt/inr":                   "Coagulation Panel",
  "pt inr":                   "Coagulation Panel",
  "inr":                      "Coagulation Panel",
  "ptt":                      "Coagulation Panel",
  "aptt":                     "Coagulation Panel",
  "prothrombin":              "Coagulation Panel",
  // LFTs
  "liver function":           "LFTs",
  "liver function tests":     "LFTs",
  "hepatic function":         "LFTs",
  // BNP/NT-proBNP
  "nt-probnp":                "BNP",
  "nt probnp":                "BNP",
  "pro-bnp":                  "BNP",
  "brain natriuretic peptide":"BNP",
  // ABG
  "arterial blood gas":       "ABG",
  "blood gas":                "ABG",
  // Lactate
  "lactic acid":              "Lactate",
  "serum lactate":            "Lactate",
  // Urinalysis
  "ua":                       "Urinalysis",
  "urine analysis":           "Urinalysis",
  // D-Dimer
  "d dimer":                  "D-Dimer",
  // Drug screen
  "toxicology screen":        "Drug Screen",
  "urine drug screen":        "Drug Screen",
  "uds":                      "Drug Screen",
  // ECG variants
  "ekg":                      "ECG",
  "electrocardiogram":        "ECG",
  "12-lead ecg":              "ECG",
  "12 lead ecg":              "ECG",
  // Chest X-ray variants
  "cxr":                      "Chest X-ray",
  "chest x ray":              "Chest X-ray",
  "chest xray":               "Chest X-ray",
  "chest radiograph":         "Chest X-ray",
  "chest pa":                 "Chest X-ray",
  // CT variants
  "ct scan head":             "CT Head",
  "ct brain":                 "CT Head",
  "ct of head":               "CT Head",
  "ct scan chest":            "CT Chest",
  "ct of chest":              "CT Chest",
  "ct pulmonary angiography": "CT PE Protocol",
  "ctpa":                     "CT PE Protocol",
  "ct angiography chest":     "CT PE Protocol",
  "ct abdomen":               "CT Abdomen/Pelvis",
  "ct pelvis":                "CT Abdomen/Pelvis",
  "ct ab/pelvis":             "CT Abdomen/Pelvis",
  // Echo
  "echo":                     "Echocardiogram",
  "cardiac echo":             "Echocardiogram",
  "transthoracic echo":       "Echocardiogram",
  "tte":                      "Echocardiogram",
  // MRI
  "mri head":                 "MRI Brain",
  "mri of the brain":         "MRI Brain",
  // Ultrasound
  "us":                       "Ultrasound",
  "bedside us":               "Ultrasound",
  "point of care ultrasound": "Ultrasound",
  "pocus":                    "Ultrasound",
  "renal ultrasound":         "Ultrasound",
  "abdominal ultrasound":     "Ultrasound",
  // Blood culture
  "blood cultures":           "Blood Culture",
};

/**
 * Normalise any test name (from AI or OrderPanel) to a canonical TURNAROUND key.
 * Strategy:
 *  1. Exact match (case-insensitive)
 *  2. Alias map lookup
 *  3. Prefix/contains match against canonical keys
 */
function normaliseName(raw: string): string {
  const lower = raw.trim().toLowerCase();

  // 1. Exact match
  const exact = Object.keys(TURNAROUND).find(k => k.toLowerCase() === lower);
  if (exact) return exact;

  // 2. Alias map
  if (ALIASES[lower]) return ALIASES[lower];

  // 3. Prefix or contains match
  const partial = Object.keys(TURNAROUND).find(k => {
    const kl = k.toLowerCase();
    return lower.startsWith(kl) || kl.startsWith(lower) || lower.includes(kl) || kl.includes(lower);
  });
  if (partial) return partial;

  // Return the raw name; the caller will return a 400 with the available list
  return raw;
}

function validateRequest(body: any) {
  if (!body || typeof body !== "object") throw new Error("Request body must be a JSON object.");
  if (!body.caseId || typeof body.caseId !== "string") throw new Error("Missing: caseId");
  if (!["lab","imaging"].includes(body.testType))        throw new Error("Invalid testType");
  if (!body.testName || typeof body.testName !== "string") throw new Error("Missing: testName");
  if (typeof body.currentSimTime !== "number")           throw new Error("Missing: currentSimTime");
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

    // Normalise: "Troponin I" → "Troponin", "EKG" → "ECG", etc.
    const testName = normaliseName(rawName);

    // Turnaround lookup
    const delays = TURNAROUND[testName];
    if (!delays) {
      return res.status(400).json({
        error: `Unknown test "${rawName}". Available: ${Object.keys(TURNAROUND).join(", ")}`,
      });
    }

    const orderedAt   = currentSimTime;
    const availableAt = currentSimTime + delays[priority];

    // Retrieve full case to get the pre-generated result
    const fullCase = await getCaseServerSide(caseId);
    if (!fullCase) {
      return res.status(404).json({ error: "Case not found. Please start a new case." });
    }

    let result: any;
    if (testType === "lab") {
      // Match by normalised name so "Troponin I" in fullCase still finds "Troponin"
      const match = (fullCase.labs || []).find(
        (l: any) => normaliseName(l.name) === testName
      );
      if (!match) {
        // AI used a name we don't have a result for — return pending placeholder
        result = {
          name: rawName, value: "Pending", unit: "", normalRange: "", status: "normal",
          orderedAt, availableAt,
        };
      } else {
        result = { ...match, orderedAt, availableAt };
      }
    } else {
      const match = (fullCase.imaging || []).find(
        (i: any) => normaliseName(i.type) === testName
      );
      if (!match) {
        result = {
          type: rawName, findings: "Pending read", impression: "Pending",
          orderedAt, availableAt,
        };
      } else {
        result = { ...match, orderedAt, availableAt };
      }
    }

    const action = {
      id:          `action-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp:   currentSimTime,
      type:        "order",
      description: `Ordered ${testName}${rawName !== testName ? ` (${rawName})` : ""} (${priority.toUpperCase()})`,
      result:      `Results expected at T+${availableAt} min`,
    };

    res.json({
      success:     true,
      testResult:  result,
      action,
      message:     `${testName} ordered. Results available at T+${availableAt} min.`,
    });
  } catch (err: any) {
    console.error("order-test error:", err);
    res.status(500).json({ error: err.message || "Failed to order test." });
  }
}
