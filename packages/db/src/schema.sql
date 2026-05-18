create table if not exists tasks (
  id text primary key,
  kind text not null,
  adapter text not null,
  payload jsonb not null,
  requires text[] not null default '{}',
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_tasks_status_created_at on tasks (status, created_at);

create table if not exists nodes (
  id text primary key,
  name text not null,
  capabilities text[] not null default '{}',
  status text not null default 'online',
  last_heartbeat_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists runs (
  id text primary key,
  task_id text not null references tasks(id),
  node_id text not null references nodes(id),
  attempt integer not null,
  status text not null,
  started_at timestamptz null,
  ended_at timestamptz null,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_runs_task_id on runs (task_id);
create index if not exists idx_runs_node_id on runs (node_id);

create table if not exists run_logs (
  id bigserial primary key,
  run_id text not null references runs(id),
  step_name text null,
  stream text not null,
  message text not null,
  timestamp timestamptz not null default now()
);

create index if not exists idx_run_logs_run_id_timestamp on run_logs (run_id, timestamp);

create table if not exists artifacts (
  id text primary key,
  run_id text not null references runs(id),
  type text not null,
  name text not null,
  path text not null,
  metadata jsonb null,
  created_at timestamptz not null default now()
);

create index if not exists idx_artifacts_run_id on artifacts (run_id);

