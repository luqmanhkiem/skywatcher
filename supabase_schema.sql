-- SkyWatcher — Supabase PostgreSQL Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ── Bags ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bags (
    tag_id          TEXT PRIMARY KEY,
    flight_id       TEXT,
    passenger       TEXT,
    status          TEXT DEFAULT 'in_transit',
    last_checkpoint TEXT,
    last_seen       TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Events ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
    id            BIGSERIAL PRIMARY KEY,
    tag_id        TEXT NOT NULL,
    checkpoint    TEXT NOT NULL,
    flight_id     TEXT,
    timestamp     TEXT NOT NULL,
    duration_mins FLOAT DEFAULT 0,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tag_id, checkpoint, timestamp)
);

-- ── Anomalies ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS anomalies (
    id          BIGSERIAL PRIMARY KEY,
    tag_id      TEXT NOT NULL,
    type        TEXT NOT NULL,
    description TEXT,
    checkpoint  TEXT,
    score       FLOAT,
    resolved    INTEGER DEFAULT 0,
    resolved_at TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('admin', 'ground_staff', 'passenger')),
    checkpoint    TEXT,
    flight_id     TEXT,
    tag_id        TEXT,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
