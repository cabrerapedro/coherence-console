-- Coherence Console — initial schema.
-- Apply against your Neon database via the SQL console or psql:
--   psql "$DATABASE_URL" -f migrations/0001_initial.sql

create table agent_actions (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  timestamp timestamptz not null,
  input text not null,
  context text,
  output text not null,
  tool_calls jsonb default '[]'::jsonb,
  autonomy_level int not null check (autonomy_level between 1 and 4),
  created_at timestamptz default now()
);

-- Two rows per action_id are allowed (Haiku, then Sonnet on escalation).
-- Exactly one row per action_id has is_final = true; UI queries filter on it.
create table classifications (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references agent_actions(id) on delete cascade,
  classification text not null check (classification in ('correct','incorrect','needs_review')),
  confidence numeric(3,2) not null,
  reasoning_steps jsonb not null,
  policy_violations jsonb default '[]'::jsonb,
  autonomy_appropriate boolean not null,
  escalation_recommended boolean not null,
  model_used text not null,
  cost_usd numeric(10,6) not null,
  classifier_version text not null,
  is_final boolean not null default false,
  created_at timestamptz default now()
);

-- v1 deliberately disallows re-labeling: one human label per action_id, ever.
-- See README "Limitations" — adding versioning is a documented ~30 min change.
create table golden_set (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references agent_actions(id) on delete cascade,
  human_label text not null check (human_label in ('correct','incorrect','needs_review')),
  human_note text,
  labeled_at timestamptz default now(),
  unique(action_id)
);

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  classifier_version text not null,
  model_primary text not null,
  model_escalation text,
  total_actions int not null,
  accuracy numeric(4,3) not null,
  precision_score numeric(4,3) not null,
  recall_score numeric(4,3) not null,
  total_cost_usd numeric(10,6) not null,
  escalation_rate numeric(4,3) not null,
  notes text,
  created_at timestamptz default now()
);

create index idx_classifications_action on classifications(action_id);
create index idx_classifications_action_final on classifications(action_id) where is_final;
create index idx_eval_runs_created on eval_runs(created_at desc);
