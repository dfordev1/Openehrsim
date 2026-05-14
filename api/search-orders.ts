/**
 * CCS-style order search endpoint.
 *
 * Fuzzy-matches the query against the AI-generated catalog in the case
 * (availableTests.labs, availableTests.imaging, availableMedications).
 * When broaden=true or too few catalog hits are found, asks DeepSeek to
 * generate additional clinically relevant options — no hardcoded list.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import OpenAI from "openai";
import { getCaseServerSide } from "./_supabase.js";

export interface OrderSearchResult {
  name: string;
  category: "lab" | "imaging" | "medication";
  route?: string;
  frequency?: string;
  stat?: number;
  routine?: number;
}

type ScoredResult = OrderSearchResult & { _score: number };

function fuzzyScore(query: string, target: string): number {
  const q = query.toLowerCase().trim();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t === q) return 100;
  if (t.startsWith(q)) return 88;
  if (t.includes(q)) return 72;
  const words = q.split(/\s+/).filter(Boolean);
  const matchCount = words.filter((w) => t.includes(w)).length;
  if (matchCount === words.length) return 58;
  return (matchCount / Math.max(words.length, 1)) * 30;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { caseId, query, broaden } = req.body ?? {};
  if (!caseId || typeof query !== "string")
    return res.status(400).json({ error: "Missing caseId or query" });

  const fullCase = await getCaseServerSide(caseId);
  if (!fullCase) return res.status(404).json({ error: "Case not found" });

  const scored: ScoredResult[] = [];

  // ── Labs ────────────────────────────────────────────────────────────────────
  for (const t of fullCase.availableTests?.labs ?? []) {
    const name = typeof t === "string" ? t : t.name;
    const score = fuzzyScore(query, name);
    if (score > 15)
      scored.push({ name, category: "lab", stat: t.stat, routine: t.routine, _score: score });
  }

  // ── Imaging ─────────────────────────────────────────────────────────────────
  for (const t of fullCase.availableTests?.imaging ?? []) {
    const name = typeof t === "string" ? t : t.name;
    const score = fuzzyScore(query, name);
    if (score > 15)
      scored.push({ name, category: "imaging", stat: t.stat, routine: t.routine, _score: score });
  }

  // ── Medications ─────────────────────────────────────────────────────────────
  for (const m of fullCase.availableMedications ?? []) {
    const score = fuzzyScore(query, m.name);
    if (score > 15)
      scored.push({
        name: m.name,
        category: "medication",
        route: m.route,
        frequency: m.frequency,
        _score: score,
      });
  }

  scored.sort((a, b) => b._score - a._score);
  const topCatalog = scored.slice(0, 12);

  // ── AI expansion ─────────────────────────────────────────────────────────────
  // Always call AI: either to broaden, or to fill in when catalog has < 4 hits
  if (broaden || topCatalog.length < 4) {
    try {
      if (!process.env.DEEPSEEK_API_KEY) throw new Error("No API key");
      const openai = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
      });

      const existing = topCatalog.map((r) => r.name).join(", ");
      const context = [
        `Chief complaint: ${fullCase.chiefComplaint ?? "unknown"}`,
        `Comorbidities: ${(fullCase.pastMedicalHistory ?? []).join("; ")}`,
        `Current medications: ${(fullCase.medications ?? []).map((m: any) => m.name).join(", ") || "none"}`,
      ].join("\n");

      const aiRes = await openai.chat.completions.create({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content: `You are a CCS order search engine for a medical simulator.
Patient context:
${context}

Return JSON: { "results": [ { "name": string, "category": "lab"|"imaging"|"medication", "route"?: string, "frequency"?: string } ] }
Rules:
- Return 6-10 clinically relevant orders matching the search query
- Do NOT repeat: ${existing || "nothing yet"}
- Medications: include dose in name (e.g. "Metoprolol tartrate 25mg"), realistic route + frequency
- Labs/imaging: use standard clinical names
- Only return orders that make clinical sense for this patient`,
          },
          {
            role: "user",
            content: `Search query: "${query}". Suggest additional matching orders.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const parsed = JSON.parse(aiRes.choices[0].message.content ?? "{}");
      const aiItems: OrderSearchResult[] = Array.isArray(parsed.results) ? parsed.results : [];
      const existingLower = new Set(topCatalog.map((r) => r.name.toLowerCase()));
      for (const item of aiItems) {
        if (item.name && !existingLower.has(item.name.toLowerCase())) {
          topCatalog.push({ ...item, _score: 0 });
        }
      }
    } catch {
      // AI expansion is best-effort — return what catalog matched
    }
  }

  const results: OrderSearchResult[] = topCatalog.map(({ _score: _, ...r }) => r);
  res.json({ results });
}
