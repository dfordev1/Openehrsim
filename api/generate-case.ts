import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "../src/lib/schema.js";

// Simple manual validation — no extra deps needed
function validateRequest(body: any) {
  if (!body || typeof body !== "object") {
    throw new Error("Request body must be a JSON object.");
  }
  const allowed = ["intern", "resident", "attending", undefined, null, ""];
  if (body.difficulty && !["intern", "resident", "attending"].includes(body.difficulty)) {
    throw new Error("Invalid difficulty value.");
  }
  const allowedCategories = [
    "cardiology", "pulmonology", "sepsis", "trauma", "neurology", "toxicology", "any", undefined, null, "",
  ];
  if (body.category && !allowedCategories.includes(body.category)) {
    throw new Error("Invalid category value.");
  }
  const allowedEnvs = ["rural", "prehospital", "tertiary", undefined, null, ""];
  if (body.environment && !allowedEnvs.includes(body.environment)) {
    throw new Error("Invalid environment value.");
  }
  return {
    category: body.category as string | undefined,
    difficulty: body.difficulty as string | undefined,
    history: Array.isArray(body.history) ? body.history : [],
    environment: body.environment as string | undefined,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { category, difficulty, history, environment } = validateRequest(req.body);

    if (!process.env.DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY.includes("MY_")) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured in environment variables." });
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com",
    });

    const envContext =
      environment === "rural"
        ? "SETTING: Rural Critical Access Hospital. Limited resources. CT takes 60 mins. Specialized labs (Troponin, Lactate) available but slow. No MRI."
        : environment === "prehospital"
        ? "SETTING: Pre-hospital (Ambulance). Only portable monitor and BASIC meds. No labs or imaging available in the field."
        : "SETTING: Level 1 Tertiary Trauma Center. All resources available.";

    const historyContext =
      history.length > 0
        ? `User's Recent Case History: ${history
            .map((h: any) => `${h.category} (${h.score}%)`)
            .join(", ")}. Avoid repeating the exact clinical presentation from these cases.`
        : "";

    // First, generate the FULL case with diagnosis (server-side only)
    const fullCaseResponse = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a high-fidelity clinical simulation engine. Generate a complete medical case with underlying diagnosis.
Difficulty Settings:
- Intern: Clear clues, classic presentations (e.g. STEMI, Sepsis).
- Resident: Mixed clues, moderate complexity (e.g. PE vs Pneumonia, DKA).
- Attending: Subtle clues, rare conditions or diagnostic dilemmas (e.g. Thyroid Storm, Serotonin Syndrome, occult Hemorrhage).

${envContext}
${historyContext}

CRITICAL CCS-STYLE REQUIREMENTS:
1. Generate the FULL case including:
   - correctDiagnosis: the actual diagnosis (e.g., "Septic Shock secondary to pneumonia")
   - explanation: brief pathophysiology explanation
   - underlyingPathology: detailed pathology for AI to use when evolving patient
   - Complete lab values and imaging findings (but these won't be visible initially)
   
2. Physical exam findings should be present but marked as "examined: false" initially

3. Labs array should contain ALL relevant lab values WITH results, but NO orderedAt/availableAt timestamps

4. Imaging array should contain ALL relevant imaging WITH findings, but NO orderedAt/availableAt timestamps

5. availableTests: Create a catalog of orderable tests:
   - labs: ["CBC", "BMP", "Troponin", "Lactate", "Blood Culture", "ABG", "Coagulation Panel", "LFTs", "Lipase", "Urinalysis", "Drug Screen"]
   - imaging: ["Chest X-ray", "CT Head", "CT Chest", "CT Abdomen/Pelvis", "Ultrasound", "ECG", "Echocardiogram"]

6. Initialize:
   - simulationTime: 0
   - currentLocation: ${environment === "prehospital" ? '"Ambulance Rescue 1"' : '"Emergency Room (ER) Bay 1"'}
   - communicationLog: []
   - medications: []
   - activeAlarms: [] (or appropriate alarms based on vitals)
   - clinicalActions: []
   - physiologicalTrend: 'stable' or 'declining' based on acuity
   - patientOutcome: "alive"
   - initialAppearance: vivid description of patient appearance (e.g., "Pale, diaphoretic, clutching chest")

7. historyOfPresentIllness: Keep this BRIEF - only what EMS/triage nurse would know

Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Generate a realistic ${difficulty || "resident"} level case in the category of ${category || "any"}.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const fullCaseContent = fullCaseResponse.choices[0].message.content;
    if (!fullCaseContent) throw new Error("Empty response from AI");

    const fullCase = JSON.parse(fullCaseContent);

    // Ensure id is always present
    if (!fullCase.id) {
      fullCase.id = `case-${Math.random().toString(36).slice(2, 9)}`;
    }

    // Store the full case in-memory for this session (in production, use Redis/DB)
    // For now, we'll keep full case in a global Map (simple solution)
    if (!global.casesStore) {
      global.casesStore = new Map();
    }
    global.casesStore.set(fullCase.id, fullCase);

    // Create the MINIMAL initial presentation (CCS-style)
    const minimalCase = {
      id: fullCase.id,
      patientName: fullCase.patientName,
      age: fullCase.age,
      gender: fullCase.gender,
      chiefComplaint: fullCase.chiefComplaint,
      historyOfPresentIllness: fullCase.historyOfPresentIllness,
      pastMedicalHistory: fullCase.pastMedicalHistory || [],
      vitals: fullCase.vitals,
      initialAppearance: fullCase.initialAppearance || "Patient appears acutely ill",
      physicalExam: {
        heent: "Not yet examined",
        cardiac: "Not yet examined",
        respiratory: "Not yet examined",
        abdomen: "Not yet examined",
        extremities: "Not yet examined",
        neurological: "Not yet examined",
        examined: false,
      },
      labs: [],  // Empty - must be ordered
      imaging: [],  // Empty - must be ordered
      availableTests: fullCase.availableTests || {
        labs: ["CBC", "BMP", "Troponin", "Lactate", "Blood Culture", "ABG", "Coagulation Panel", "LFTs", "Lipase", "Urinalysis"],
        imaging: ["Chest X-ray", "CT Head", "CT Chest", "CT Abdomen/Pelvis", "Ultrasound", "ECG", "Echocardiogram"],
      },
      medications: [],
      activeAlarms: fullCase.activeAlarms || [],
      currentCondition: fullCase.currentCondition,
      physiologicalTrend: fullCase.physiologicalTrend || "stable",
      clinicalActions: [],
      simulationTime: 0,
      currentLocation: fullCase.currentLocation,
      communicationLog: [],
      difficulty: fullCase.difficulty || difficulty,
      category: fullCase.category || category,
      patientOutcome: "alive",
    };

    // Return ONLY the minimal case to the client
    res.json(minimalCase);
  } catch (error: any) {
    console.error("DeepSeek Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate case" });
  }
}
