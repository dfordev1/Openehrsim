import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { MEDICAL_CASE_SCHEMA } from "./_schema";

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

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `You are a high-fidelity clinical simulation engine. Generate a complex, acute medical case.
Difficulty Settings:
- Intern: Clear clues, classic presentations (e.g. STEMI, Sepsis).
- Resident: Mixed clues, moderate complexity (e.g. PE vs Pneumonia, DKA).
- Attending: Subtle clues, rare conditions or diagnostic dilemmas (e.g. Thyroid Storm, Serotonin Syndrome, occult Hemorrhage).

${envContext}
${historyContext}

CRITICAL REQUIREMENTS:
- You MUST generate a unique "id" field for the case (e.g. "case-a1b2c3" or a short UUID). Do NOT omit it.
- Initialize simulationTime at 0.
- Initialize currentLocation as ${environment === "prehospital" ? '"Ambulance Rescue 1"' : '"Emergency Room (ER) Bay 1"'}.
- Initialize communicationLog, medications, and activeAlarms as empty arrays.
- Initialize physiologicalTrend as 'stable' or 'declining' based on acuity.
- ALL labs and imaging should NOT have orderedAt or availableAt yet.
- For any IV fluid medications, set isIVFluid: true and volumeML to the appropriate volume.
- Set patientOutcome to "alive".
Output MUST be valid JSON adhering to: ${MEDICAL_CASE_SCHEMA}`,
        },
        {
          role: "user",
          content: `Generate a realistic ${difficulty || "resident"} level case in the category of ${category || "any"}.`,
        },
      ],
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI");

    const parsed = JSON.parse(content);

    // Ensure id is always present as a fallback
    if (!parsed.id) {
      parsed.id = `case-${Math.random().toString(36).slice(2, 9)}`;
    }

    res.json(parsed);
  } catch (error: any) {
    console.error("DeepSeek Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate case" });
  }
}
