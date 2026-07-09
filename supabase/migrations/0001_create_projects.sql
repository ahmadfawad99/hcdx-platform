-- Run in the Supabase SQL editor (or via `supabase db push`) before deploying.
-- Mirrors the shape lib/store.js reads/writes.

create table if not exists projects (
  id             text primary key,
  source_url     text not null,
  captured_at    timestamptz not null,
  capture_mode   text not null,
  editable_count integer not null default 0,
  original_html  text not null,
  draft_html     text not null,
  published_html text,
  status         text not null default 'draft',
  updated_at     timestamptz not null default now()
);

create index if not exists projects_updated_at_idx on projects (updated_at desc);

-- The app talks to Supabase with the service_role key from a trusted server
-- context (Next.js API routes), which bypasses RLS. Enable RLS anyway so the
-- anon/public key (if ever exposed) has no access by default.
alter table projects enable row level security;
