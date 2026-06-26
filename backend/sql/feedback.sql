-- SkyWatcher — customer feedback / issue reports
-- Run this once in the Supabase SQL editor (Database → SQL Editor).

create table if not exists feedback (
  id          bigint generated always as identity primary key,
  name        text not null,
  email       text,
  flight_id   text,
  tag_id      text,
  category    text not null check (category in
              ('lost_bag','damaged_bag','delayed_bag','complaint','suggestion','other')),
  message     text not null,
  status      text not null default 'new' check (status in ('new','in_review','resolved')),
  staff_notes text,
  resolved_by text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz
);

create index if not exists feedback_status_idx     on feedback (status);
create index if not exists feedback_created_at_idx on feedback (created_at desc);
