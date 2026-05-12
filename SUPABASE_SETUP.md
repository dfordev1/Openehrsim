# Supabase Setup Instructions

Run the following SQL in your Supabase SQL Editor to initialize the persistence layer for the Clinical Simulator.

```sql
-- Create the simulation_results table
create table simulation_results (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  user_id uuid references auth.users(id),
  case_id text,
  patient_name text,
  age int,
  category text,
  difficulty text,
  user_diagnosis text,
  correct_diagnosis text,
  score int,
  feedback text,
  simulation_time int,
  clinical_actions jsonb,
  medications jsonb
);

-- Enable RLS (Optional for now, but recommended for production)
alter table simulation_results enable row level security;

-- Create policy to allow authenticated users to insert their own results
create policy "Allow authenticated inserts" 
  on simulation_results for insert 
  with check (auth.uid() = user_id or user_id is null);

-- Create policy to allow user to read their own results
create policy "Allow users to read own results" 
  on simulation_results for select 
  using (auth.uid() = user_id or user_id is null);
```

## Direct Database Access
You can also connect to your database directly using the connection string Provided:
`postgresql://postgres:[YOUR-PASSWORD]@db.zkvntxnkmwwaernlzjky.supabase.co:5432/postgres`

Use a tool like **DBeaver**, **pgAdmin**, or the **Supabase SQL Editor** to run migrations or inspect data for research purposes.
