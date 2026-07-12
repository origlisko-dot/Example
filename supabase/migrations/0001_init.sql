-- ============================================================================
-- Pelozen Caller — initial schema
-- Lean, single-org. No recordings table by default (owner: "don't store in
-- bulk") — we keep structured outcomes + short text transcripts only.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ── enums ───────────────────────────────────────────────────────────────────
create type lead_status as enum (
  'new', 'queued', 'contacted', 'qualified', 'disqualified', 'suppressed', 'dead'
);

create type disposition as enum (
  'qualified_for_human', 'interested', 'callback_later', 'not_relevant',
  'opted_out', 'no_answer', 'wrong_number', 'failed'
);

create type call_state as enum (
  'queued', 'scheduled', 'dialing', 'in_progress', 'completed',
  'no_answer', 'busy', 'failed', 'voicemail'
);

create type run_state as enum ('running', 'paused', 'stopped', 'done');
create type suppression_reason as enum ('opt_out', 'dnc_registry', 'manual');
create type lead_source as enum ('csv', 'scraper', 'api');
create type app_role as enum ('owner', 'admin');

-- ── users / profiles (mirrors Supabase auth.users) ──────────────────────────
create table profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  role        app_role not null default 'admin',
  created_at  timestamptz not null default now()
);

-- ── operational config ──────────────────────────────────────────────────────
create table calling_windows (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  timezone    text not null default 'Asia/Jerusalem',
  start_hour  int  not null default 9,
  end_hour    int  not null default 20,
  friday_end_hour int,                       -- null = closed Friday
  saturday_open boolean not null default false,
  blackout_dates date[] not null default '{}'
);

create table retry_policies (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  max_attempts  int  not null default 3,
  backoff_steps int[] not null default '{180, 1440}',  -- minutes: +3h, +1d
  voicemail_action text not null default 'none'         -- none | leave_message
);

-- ── campaigns (the ~20 topics) ──────────────────────────────────────────────
create table campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                 -- Hebrew topic name
  pelozen_topic_ref text,
  status        text not null default 'draft', -- draft | active | archived
  locale        text not null default 'he-IL',

  intro_script  text not null default '',
  value_prop    text not null default '',
  qualifying_questions jsonb not null default '[]',
  objection_handlers   jsonb not null default '[]',
  closing_script text not null default '',

  outcome_schema jsonb not null default '[]',
  success_expr   text not null default 'false',
  disqualify_expr text not null default 'false',

  voice          jsonb not null default '{}',  -- VoiceSettings
  dynamic_variables text[] not null default '{}',
  max_call_duration_sec int not null default 300,

  -- compliance snapshot per campaign (lets the operator flip per topic)
  ai_disclosure_on boolean not null default false,

  calling_window_id uuid references calling_windows (id),
  retry_policy_id   uuid references retry_policies (id),

  version       int not null default 1,
  created_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── consent records (the legal backbone) ────────────────────────────────────
create table consent_records (
  id          uuid primary key default gen_random_uuid(),
  phone_e164  text not null,
  source      text not null default 'pelozen_callback',
  evidence_ref text,                            -- e.g. pelozen consent timestamp/id
  captured_at timestamptz not null default now()
);

-- ── leads ───────────────────────────────────────────────────────────────────
create table leads (
  id            uuid primary key default gen_random_uuid(),
  campaign_id   uuid references campaigns (id) on delete set null,
  phone_e164    text not null,
  phone_hash    text not null,                  -- HMAC for lookups
  first_name    text,
  fields        jsonb not null default '{}',
  status        lead_status not null default 'new',
  source        lead_source not null default 'csv',
  consent_record_id uuid references consent_records (id),
  suppressed_reason suppression_reason,
  last_called_at timestamptz,
  created_at    timestamptz not null default now(),
  unique (phone_e164)                           -- dedup + opt-out join key
);
create index leads_campaign_status_idx on leads (campaign_id, status);
create index leads_phone_hash_idx on leads (phone_hash);

-- ── runs (one operator "start" of a campaign batch) ─────────────────────────
create table runs (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns (id),
  operator_id uuid references profiles (id),
  state       run_state not null default 'running',
  pacing_cpm  numeric,                          -- calls per minute observed
  stats       jsonb not null default '{}',
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

-- ── call attempts ───────────────────────────────────────────────────────────
create table call_attempts (
  id              uuid primary key default gen_random_uuid(),
  run_id          uuid references runs (id) on delete cascade,
  lead_id         uuid not null references leads (id) on delete cascade,
  campaign_version int not null default 1,
  provider_call_id text,
  state           call_state not null default 'queued',
  attempt_no      int not null default 1,
  scheduled_for   timestamptz,
  dialed_at       timestamptz,
  answered_at     timestamptz,
  ended_at        timestamptz,
  duration_sec    int,
  end_reason      text,
  ai_disclosed    boolean not null default false, -- snapshot of the toggle at call time
  cost_breakdown  jsonb not null default '{}',
  created_at      timestamptz not null default now()
);
create index call_attempts_run_idx on call_attempts (run_id);
create index call_attempts_lead_idx on call_attempts (lead_id);

-- ── outcomes (from the LLM's record_outcome tool call) ──────────────────────
create table outcomes (
  id              uuid primary key default gen_random_uuid(),
  call_attempt_id uuid not null references call_attempts (id) on delete cascade,
  lead_id         uuid not null references leads (id) on delete cascade,
  disposition     disposition not null,
  structured      jsonb not null default '{}',   -- matches campaign.outcome_schema
  callback_at     timestamptz,
  qualified       boolean not null default false,
  agent_notes     text,
  outcome_set_by  text not null default 'ai',     -- ai | operator
  created_at      timestamptz not null default now()
);
create index outcomes_lead_idx on outcomes (lead_id);

-- ── transcripts (short text only — no bulk audio) ───────────────────────────
create table transcripts (
  id              uuid primary key default gen_random_uuid(),
  call_attempt_id uuid not null references call_attempts (id) on delete cascade,
  segments        jsonb not null default '[]',    -- [{speaker, text, t_start, t_end}]
  language        text not null default 'he',
  created_at      timestamptz not null default now()
);

-- ── suppression list (opt-out + DNC) — checked before EVERY dial ────────────
create table suppression_list (
  phone_e164    text primary key,
  phone_hash    text not null,
  reason        suppression_reason not null,
  source_call_id uuid references call_attempts (id),
  added_by      uuid references profiles (id),
  added_at      timestamptz not null default now()
);
create index suppression_phone_hash_idx on suppression_list (phone_hash);

-- ── append-only audit log ───────────────────────────────────────────────────
create table audit_log (
  id          bigserial primary key,
  actor       text,
  action      text not null,
  entity      text,
  entity_id   text,
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);

-- ── RLS: single org, authenticated users (owner/admin) full access. ─────────
-- The orchestrator uses the service-role key and bypasses RLS; the web client
-- uses the anon key and is gated by these policies.
alter table profiles        enable row level security;
alter table campaigns       enable row level security;
alter table calling_windows enable row level security;
alter table retry_policies  enable row level security;
alter table leads           enable row level security;
alter table runs            enable row level security;
alter table call_attempts   enable row level security;
alter table outcomes        enable row level security;
alter table transcripts     enable row level security;
alter table consent_records enable row level security;
alter table suppression_list enable row level security;
alter table audit_log       enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','campaigns','calling_windows','retry_policies','leads','runs',
    'call_attempts','outcomes','transcripts','consent_records',
    'suppression_list','audit_log'
  ]
  loop
    execute format(
      'create policy %I_authenticated on %I for all to authenticated using (true) with check (true);',
      t, t
    );
  end loop;
end $$;
