-- SkyWatcher — passenger experience: checkpoint advisories + arrival emails
-- Run this once in the Supabase SQL editor (Database → SQL Editor) BEFORE the
-- advisory banners and "notify me on arrival" features will work.

-- 1. Operator-declared checkpoint service advisories.
--    level: operational (normal), degraded (delays), down (stopped).
--    Surfaced to passengers whose bag still has this checkpoint ahead of it.
create table if not exists checkpoint_advisories (
  id         bigint generated always as identity primary key,
  checkpoint text not null unique,
  level      text not null default 'operational'
             check (level in ('operational', 'degraded', 'down')),
  message    text,
  active     boolean not null default false,   -- true while level is degraded/down
  updated_by text,
  updated_at timestamptz not null default now()
);

-- 2. Opt-in arrival notifications. A passenger leaves their email on the public
--    tracking page; the backend emails them once when the bag reaches ARRIVED.
create table if not exists arrival_subscriptions (
  id          bigint generated always as identity primary key,
  tag_id      text not null,
  email       text not null,
  notified    boolean not null default false,
  notified_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (tag_id, email)
);

create index if not exists arrival_sub_tag_idx
  on arrival_subscriptions (tag_id);
