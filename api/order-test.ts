import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * CCS-Style Order Test Endpoint
 * 
 * Handles ordering of labs and imaging studies.
 * Sets orderedAt timestamp and calculates availableAt based on:
 * - Test type (labs faster than imaging)
 * - Location (tertiary faster than rural)
 * - Stat vs routine
 */

interface OrderTestRequest {
  caseId: string;
  testType: 'lab' | 'imaging';
  testName: string;
  priority?: 'stat' | 'routine';
  currentSimTime: number;
}

// Test processing times (in minutes)
const TEST_DELAYS = {
  // Labs
  'CBC': { stat: 15, routine: 30 },
  'BMP': { stat: 15, routine: 30 },
  'Troponin': { stat: 20, routine: 45 },
  'Lactate': { stat: 10, routine: 20 },
  'Blood Culture': { stat: 30, routine: 60 },  // Initial gram stain
  'ABG': { stat: 5, routine: 15 },
  'Coagulation Panel': { stat: 20, routine: 40 },
  'LFTs': { stat: 20, routine: 45 },
  'Lipase': { stat: 20, routine: 45 },
  'Urinalysis': { stat: 15, routine: 30 },
  'Drug Screen': { stat: 30, routine: 60 },
  
  // Imaging
  'Chest X-ray': { stat: 20, routine: 45 },
  'CT Head': { stat: 30, routine: 60 },
  'CT Chest': { stat: 30, routine: 60 },
  'CT Abdomen/Pelvis': { stat: 35, routine: 70 },
  'Ultrasound': { stat: 25, routine: 50 },
  'ECG': { stat: 5, routine: 10 },
  'Echocardiogram': { stat: 30, routine: 60 },
};

function validateRequest(body: any): OrderTestRequest {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  if (!body.caseId || typeof body.caseId !== "string") {
    throw new Error("Missing or invalid field: caseId");
  }
  if (!body.testType || !['lab', 'imaging'].includes(body.testType)) {
    throw new Error("Invalid testType. Must be 'lab' or 'imaging'.");
  }
  if (!body.testName || typeof body.testName !== "string") {
    throw new Error("Missing or invalid field: testName");
  }
  if (body.currentSimTime === undefined || typeof body.currentSimTime !== "number") {
    throw new Error("Missing or invalid field: currentSimTime");
  }
  
  return {
    caseId: body.caseId,
    testType: body.testType,
    testName: body.testName,
    priority: body.priority || 'stat',  // Default to stat in ER
    currentSimTime: body.currentSimTime,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { caseId, testType, testName, priority, currentSimTime } = validateRequest(req.body);

    // Retrieve the full case from storage
    if (!global.casesStore || !global.casesStore.has(caseId)) {
      return res.status(404).json({ error: "Case not found. Please start a new case." });
    }

    const fullCase = global.casesStore.get(caseId);

    // Calculate delay
    const delays = TEST_DELAYS[testName as keyof typeof TEST_DELAYS];
    if (!delays) {
      return res.status(400).json({ 
        error: `Unknown test: ${testName}. Available tests: ${Object.keys(TEST_DELAYS).join(', ')}` 
      });
    }

    const delay = priority === 'stat' ? delays.stat : delays.routine;
    const orderedAt = currentSimTime;
    const availableAt = currentSimTime + delay;

    // Find the test result from the full case
    let testResult;
    if (testType === 'lab') {
      testResult = fullCase.labs.find((lab: any) => lab.name === testName);
      if (!testResult) {
        return res.status(400).json({ error: `Lab test "${testName}" not available for this case.` });
      }
      testResult = {
        ...testResult,
        orderedAt,
        availableAt,
      };
    } else {
      testResult = fullCase.imaging.find((img: any) => img.type === testName);
      if (!testResult) {
        return res.status(400).json({ error: `Imaging test "${testName}" not available for this case.` });
      }
      testResult = {
        ...testResult,
        orderedAt,
        availableAt,
      };
    }

    // Add to clinical actions
    const action = {
      id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: currentSimTime,
      type: 'order',
      description: `Ordered ${testName} (${priority})`,
      result: `Results expected at T+${availableAt} min`,
    };

    res.json({
      success: true,
      testResult,
      action,
      message: `${testName} ordered. Results available at simulation time ${availableAt} minutes.`,
    });
  } catch (error: any) {
    console.error("Order Test Error:", error);
    res.status(500).json({ error: error.message || "Failed to order test." });
  }
}
