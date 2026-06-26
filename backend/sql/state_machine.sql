-- SkyWatcher — bag state machine (FSM) support
-- Run this once in the Supabase SQL editor (Database → SQL Editor) BEFORE the
-- scan / action / status-history features will work.
--
-- bags.status now stores FSM states (REGISTERED, SCREENED, SORTED, LOADED,
-- ARRIVED, CLAIMED, FLAGGED, MISROUTED, HELD, LOST). It is a plain text column,
-- so existing 'in_transit' / 'arrived' rows keep working — the backend maps
-- those legacy values into FSM states on first touch (see state_machine.py).

-- 1. When the bag's status last changed.
alter table bags add column if not exists status_updated_at timestamptz;

-- 2. Auditable state-transition trail — one row per status change.
create table if not exists bag_status_history (
  id          bigint generated always as identity primary key,
  tag_id      text not null,
  from_status text,                       -- null on a bag's very first event
  to_status   text not null,
  trigger     text not null,              -- e.g. 'scan:security' or 'action:hold'
  actor       text,                       -- 'device', or the operator's username
  checkpoint  text,
  created_at  timestamptz not null default now()
);

create index if not exists bag_status_history_tag_idx
  on bag_status_history (tag_id, created_at);
