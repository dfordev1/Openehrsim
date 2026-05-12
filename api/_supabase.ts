/**
 * Server-side Supabase client for API routes.
 * Uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS) — never expose to client.
 *
 * Required env vars (set in Vercel dashboard):
 *   SUPABASE_URL              — same value as VITE_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY — Project Settings → API → service_role secret
 */
import { createClient } from "@supabase/supabase-js";

let _client: ReturnType<typeof createClient> | null = null;

export function getServerSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

// ── In-memory fallback (single-instance dev / when Supabase isn't configured) ─
function mem(): Map<string, any> {
  (global as any).__casesStore ??= new Map<string, any>();
  return (global as any).__casesStore as Map<string, any>;
}

// ── Typed table helper — avoids TS2353 on untyped Supabase client ─────────────
function activeCases(db: ReturnType<typeof createClient>) {
  return (db as any).from("active_cases");
}

/** Persist the FULL case (including correctDiagnosis) server-side. */
export async function storeCaseServerSide(caseId: string, fullCase: object): Promise<void> {
  const db = getServerSupabase();
  if (!db) { mem().set(caseId, fullCase); return; }
  const { error } = await activeCases(db).upsert({
    id:         caseId,
    full_case:  fullCase,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 h TTL
  });
  if (error) throw new Error(`storeCaseServerSide: ${error.message}`);
}

/** Retrieve the full case. Returns null if not found. */
export async function getCaseServerSide(caseId: string): Promise<any | null> {
  const db = getServerSupabase();
  if (!db) return mem().get(caseId) ?? null;
  const { data, error } = await activeCases(db)
    .select("full_case")
    .eq("id", caseId)
    .single();
  if (error || !data) return null;
  return (data as any).full_case;
}

/** Update the persisted case after each intervention / time-advance. */
export async function updateCaseServerSide(caseId: string, fullCase: object): Promise<void> {
  const db = getServerSupabase();
  if (!db) { mem().set(caseId, fullCase); return; }
  const { error } = await activeCases(db)
    .update({ full_case: fullCase })
    .eq("id", caseId);
  if (error) throw new Error(`updateCaseServerSide: ${error.message}`);
}

/** Delete case once scoring is done. */
export async function deleteCaseServerSide(caseId: string): Promise<void> {
  const db = getServerSupabase();
  if (!db) { mem().delete(caseId); return; }
  await activeCases(db).delete().eq("id", caseId);
}
