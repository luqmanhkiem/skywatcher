-- SkyWatcher — advisory request/approval workflow
-- Run once in Supabase SQL editor.

create table if not exists advisory_requests (
  id           bigint generated always as identity primary key,
  checkpoint   text not null,
  level        text not null check (level in ('operational', 'degraded', 'down')),
  message      text,
  requested_by text not null,
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected')),
  reviewed_by  text,
  created_at   timestamptz not null default now(),
  reviewed_at  timestamptz
);

create index if not exists advisory_req_status_idx on advisory_requests (status, created_at desc);
