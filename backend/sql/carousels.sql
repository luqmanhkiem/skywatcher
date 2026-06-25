-- SkyWatcher — per-flight carousel/belt assignment
-- Run once in the Supabase SQL editor (Database → SQL Editor).

create table if not exists flight_carousels (
  flight_id  text primary key,
  carousel   text not null,
  set_by     text,
  set_at     timestamptz not null default now()
);
