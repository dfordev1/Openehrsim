# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start local dev server (requires Vercel CLI — runs both Vite + API routes)
npm run build        # Production build via Vite
npm run lint         # TypeScript type-check only (tsc --noEmit) — no eslint configured
npm run test         # Vitest in watch mode
npm run test:run     # Vitest single run with verbose output
```

The `lint` command reports many pre-existing errors due to `tsconfig.json` not including `node` types globally. These are not regressions — only check for new errors in files you touch.

To run a single test file: `npx vitest run src/path/to/file.test.ts`

## Architecture

### Deployment model
Vercel SPA + serverless functions. `vercel.json` rewrites all non-`/api/*` routes to `index.html`. Local dev requires `vercel dev` (not `vite dev`) so the `/api` routes are served.

### The answer-key security invariant
This is the most important design constraint. When a case is generated, the full case (including `correctDiagnosis`, `explanation`, `underlyingPathology`) is stored **server-side only** in Supabase `active_cases` table via `api/_supabase.ts`. The client **never** receives these fields during an active simulation. `api/perform-intervention.ts` explicitly strips them before responding (`const { correctDiagnosis, explanation, underlyingPathology, ...clientCase } = updated`). Do not add any endpoint or client-side code that exposes these fields.

### Data flow for a simulation session
1. `POST /api/generate-case` → DeepSeek generates full case, server stores it in Supabase, client gets public fields only
2. `POST /api/perform-intervention` → server reads hidden pathology from Supabase, evolves patient via DeepSeek, writes updated case back, strips secrets before response
3. `POST /api/order-test` → returns lab/imaging results with simulated turnaround times (logic in `src/utils/normaliseTestName.ts`)
4. `POST /api/end-case` → server fetches answer key, scores via DeepSeek, deletes the `active_cases` row, persists result to `simulation_results`

### State management
Three React contexts, provider order in `src/App.tsx`: `AuthContext` → `CaseProvider` → `NavigationProvider`.

- **`CaseContext`** (`src/contexts/CaseContext.tsx`): Thin orchestrator. Composes three handler hooks (`useInterventionHandlers`, `useCommsHandlers`, `useEvaluationHandlers`), plus owns case loading, vitals history, activity logs, undo/redo, clinical reasoning, and stage navigation.
- **`NavigationContext`**: Active tab, sidebar/modal open states, keyboard shortcuts wiring.
- **`AuthContext`**: Supabase auth session only.

Handler hook responsibilities:
- `useInterventionHandlers` — `intervening` lock, `interventionInput`, `handlePerformIntervention`, `handleOrderTest`, `handleAdvanceTime`
- `useCommsHandlers` — `calling` lock, `callTarget`/`callMessage`, consultant state, `handleStaffCall`, `handleConsult`
- `useEvaluationHandlers` — `submitting` lock, notes/evaluation/differential state, `handleEndCase`

Pure UI-only state (`gcsState`, `selectedLab`, `revealedStudies`, `customMedInput`, `transferExpanded`, `vitalsExpanded`) lives as local `useState` in `ClinicalLayoutInner` and is not in any context.

### AI usage
- **DeepSeek** (`deepseek-chat` via OpenAI-compatible SDK): case generation, patient state evolution, scoring
- **Gemini** (`gemini-2.0-flash-lite`): consultant advice only (`/api/consult`), preferred when `GEMINI_API_KEY` is set; falls back to DeepSeek
- `GEMINI_API_KEY` is server-side only — intentionally excluded from Vite's client bundle (see `vite.config.ts` comment)

All API calls from the frontend go through `src/services/geminiService.ts`, which calls the Vercel serverless functions (not AI APIs directly). The service also trims `clinicalActions` (last 12) and `communicationLog` (last 10) before sending to bound token growth.

### Schema source of truth
`src/lib/schema.ts` exports `MEDICAL_CASE_SCHEMA` — a TypeScript interface string injected verbatim into every AI system prompt. When you change the `MedicalCase` shape in `src/types.ts`, update `src/lib/schema.ts` to match, and check `api/_schema.ts` (server-side copy).

### Clinical reasoning / workflow gates
`src/hooks/useClinicalReasoning.ts` tracks the Healer-style assessment: problem representation drafts, differentials, findings, illness scripts, and stage commitments. `handleStageNavigate` in `CaseContext` enforces gates — learners must commit a PR + differentials before advancing to the next `WorkflowStage`. The stage order is defined in `STAGE_ORDER` exported from `useClinicalReasoning.ts`.

### Supabase clients — two separate instances
- **Client-side** (`src/lib/supabase.ts`): uses `VITE_SUPABASE_ANON_KEY`, subject to RLS
- **Server-side** (`api/_supabase.ts`): uses `SUPABASE_SERVICE_ROLE_KEY`, bypasses RLS — only import this in `api/` files, never in `src/`

In-memory `Map` fallback (`global.__casesStore`) activates automatically when Supabase env vars are absent, enabling dev without a DB.

## Environment variables

| Variable | Side | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Public anon key (RLS-gated) |
| `SUPABASE_URL` | server | Same value as above |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Bypasses RLS — never expose to browser |
| `DEEPSEEK_API_KEY` | server | Primary LLM |
| `GEMINI_API_KEY` | server | Consultant LLM (optional, falls back to DeepSeek) |

## Database schema

See `SUPABASE_SETUP.md` for full SQL. Two tables:
- `active_cases` — in-flight sessions, 2-hour TTL, no user-accessible RLS policies
- `simulation_results` — scored completions; `reasoning_score`, `problem_representation`, `differentials` columns are optional (added by a migration — `end-case.ts` degrades gracefully if absent)
