-- Enables ON CONFLICT (agent_id, timestamp) DO NOTHING for batch inserts in
-- scripts/seed_one.ts and the upcoming H3 batch loader (80 synthetic actions).
-- Without this, idempotency required a separate SELECT per row — 80 round-trips
-- to Neon for what should be a single statement.

alter table agent_actions
  add constraint agent_actions_agent_timestamp_unique unique (agent_id, timestamp);
