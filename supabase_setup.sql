-- supabase_setup.sql
-- Run this once in Supabase: left sidebar -> SQL Editor -> paste -> RUN.
-- Creates the two tables the song-contest web app needs.

-- Contestants ---------------------------------------------------------------
create table if not exists contestants (
  id uuid primary key default gen_random_uuid(),
  number int,
  name text not null,
  song text not null,
  language text not null,
  artist text default '',
  contact text default '',
  note text default '',
  owner text not null,          -- display name of the signer
  owner_token text not null,    -- random per-device token; only this token may delete
  created_at timestamptz default now()
);

-- Scores: one row per (contestant, seat). ------------------------------------
-- A UNIQUE(contestant_id, seat) constraint means a seat can be filled only
-- once -> enforces "cannot edit after submit" and avoids concurrent overwrite.
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references contestants(id) on delete cascade,
  seat int not null,
  dims jsonb not null default '{}'::jsonb,
  total numeric not null default 0,
  by_name text default '',
  created_at timestamptz default now(),
  unique (contestant_id, seat)
);

-- Row Level Security --------------------------------------------------------
-- This is a small trusted contest, so we allow the anon key to read/insert,
-- and allow deletes (ownership is enforced in the app by owner_token, and the
-- admin reset uses the admin code). This keeps setup simple and free.
alter table contestants enable row level security;
alter table scores enable row level security;

-- Contestants: anyone with the anon key can read, insert, and delete.
drop policy if exists contestants_read on contestants;
create policy contestants_read on contestants for select using (true);

drop policy if exists contestants_insert on contestants;
create policy contestants_insert on contestants for insert with check (true);

drop policy if exists contestants_delete on contestants;
create policy contestants_delete on contestants for delete using (true);

-- Scores: anyone can read and insert. No update/delete policy => scores can
-- NOT be edited or individually deleted (locked after submit). They are only
-- removed via cascade when a contestant is deleted, or by the admin reset
-- (which deletes contestants, cascading to scores).
drop policy if exists scores_read on scores;
create policy scores_read on scores for select using (true);

drop policy if exists scores_insert on scores;
create policy scores_insert on scores for insert with check (true);
