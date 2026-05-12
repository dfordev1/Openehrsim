# Supabase Setup — OpenEHR Sim

Run the following SQL in your **Supabase SQL Editor** to initialise the persistence layer.

---

## 1. `simulation_results` — scored cases

```sql
create table if not exists simulation_results (
  id                   uuid default gen_random_uuid() primary key,
  created_at           timestamptz default timezone('utc', now()) not null,
  user_id              uuid references auth.users(id),
  case_id              text,
  patient_name         text,
  age                  int,
  category             text,
  difficulty           text,
  user_diagnosis       text,
  correct_diagnosis    text,
  score                int,
  feedback             text,
  simulation_time      int,
  clinical_actions     jsonb,
  medications          jsonb,
  -- CCS management-score columns (added by this migration)
  management_breakdown jsonb,   -- { initialManagement, diagnosticWorkup, therapeuticInterventions, patientOutcome, efficiencyPenalty }
  key_actions          jsonb,   -- string[]
  clinical_pearl       text,
  -- Clinical-reasoning columns (Healer-style). Optional but recommended.
  reasoning_score        jsonb, -- { dataAcquisitionThoroughness, ..., overall } on 0-100 scale
  problem_representation text,
  differentials          jsonb  -- [{ diagnosis, confidence, isLead }]
);

alter table simulation_results enable row level security;

create policy "insert own results"
  on simulation_results for insert
  with check (auth.uid() = user_id or user_id is null);

create policy "read own results"
  on simulation_results for select
  using (auth.uid() = user_id or user_id is null);
```

> If you already created `simulation_results` before the reasoning columns
> were introduced, add them with:
> ```sql
> alter table simulation_results
>   add column if not exists reasoning_score        jsonb,
>   add column if not exists problem_representation text,
>   add column if not exists differentials          jsonb;
> ```
>
> The `/api/end-case` handler degrades gracefully if these columns are
> missing — the row is still saved without the reasoning fields.

---

## 2. `active_cases` — in-flight CCS sessions (**new**)

Stores the full case (including hidden `correctDiagnosis`) server-side so that
every Vercel serverless function instance can access it — no in-memory globals.

```sql
create table if not exists active_cases (
  id          text primary key,             -- matches MedicalCase.id
  full_case   jsonb not null,               -- entire case including answer key
  created_at  timestamptz default timezone('utc', now()) not null,
  expires_at  timestamptz not null          -- auto-set to created_at + 2 hours
);

-- Auto-delete expired sessions (run once, keeps the table clean)
create index if not exists active_cases_expires_idx on active_cases (expires_at);

-- RLS: service-role key bypasses this; anon / logged-in users cannot read raw cases
alter table active_cases enable row level security;

-- No SELECT/INSERT/UPDATE/DELETE policies for end-users intentionally.
-- Only the service-role key (used in API routes) may access this table.
```

> **Tip:** Set up a Supabase Edge Function or a pg_cron job to purge expired rows:
> ```sql
> delete from active_cases where expires_at < now();
> ```

---

## 3. Environment variables

### Vercel (server-side — API routes)
| Variable | Where to find it |
|---|---|
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` secret |
| `DEEPSEEK_API_KEY` | DeepSeek dashboard |

### Vercel / local (client-side — Vite)
| Variable | Where to find it |
|---|---|
| `VITE_SUPABASE_URL` | same as `SUPABASE_URL` |
| `VITE_SUPABASE_ANON_KEY` | Project Settings → API → `anon` public key |

> `SUPABASE_SERVICE_ROLE_KEY` is **never** exposed to the browser.
> It is only used in server-side API routes via `api/_supabase.ts`.
