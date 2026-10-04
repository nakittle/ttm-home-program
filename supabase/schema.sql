-- TTM Home Program schema. Run once in Supabase → SQL Editor.
-- No table stores a patient's name, national ID, phone or HN.

create extension if not exists pgcrypto;

create table if not exists clinics (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  pin_hash text not null,
  phone text,
  is_demo boolean not null default false,
  settings jsonb not null default '{"disabled":[],"thresholds":{}}',
  created_at timestamptz not null default now()
);

create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  secret_hash text not null,
  clinic_id uuid not null references clinics(id) on delete cascade,
  group_ids text[] not null,
  posture_ids text[] not null,
  days_per_week int not null check (days_per_week between 1 and 7),
  remind_time text not null,
  start_date date not null,
  next_visit_date date not null,
  status text not null default 'active' check (status in ('active','completed','stopped')),
  consent_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  performed_on date not null,
  pain_before int check (pain_before between 0 and 10),
  pain_after int check (pain_after between 0 and 10),
  results jsonb not null,
  answers jsonb not null,
  client_id text not null,
  created_at timestamptz not null default now(),
  unique (plan_id, client_id)
);

create table if not exists flags (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references plans(id) on delete cascade,
  session_id uuid references sessions(id) on delete cascade,
  rule_id text not null,
  level text not null check (level in ('call_1669','stop_and_contact_clinic','pause_posture','note_for_next_visit')),
  posture_id text,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists plans_clinic_idx on plans(clinic_id);
create index if not exists sessions_plan_idx on sessions(plan_id);
create index if not exists flags_plan_idx on flags(plan_id);

-- The app talks to the database only from the server with the service role key.
-- Turn on RLS with no policies so the anon/public key can read or write nothing.
alter table clinics enable row level security;
alter table plans enable row level security;
alter table sessions enable row level security;
alter table flags enable row level security;
