-- supabase_setup.sql  (v2 — tournament rounds)
-- Run in Supabase: SQL Editor -> New query -> paste -> RUN.
--
-- If you already ran v1 before, this script also upgrades existing tables by
-- adding the new columns / tables. Safe to run more than once.

-- ---------- Contestants ----------
create table if not exists contestants (
  id uuid primary key default gen_random_uuid(),
  number int,
  name text not null,
  song text not null,
  language text not null,
  artist text default '',
  contact text default '',
  note text default '',
  owner text not null,
  owner_token text not null,
  created_at timestamptz default now()
);

-- advanced_to = the highest round this contestant is allowed to be scored in.
-- Everyone starts at round 1. The admin "下一轮" bumps the top N to the next round.
alter table contestants add column if not exists advanced_to int not null default 1;
alter table contestants add column if not exists eliminated boolean not null default false;

-- ---------- Scores (one row per contestant + seat + round) ----------
create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  contestant_id uuid not null references contestants(id) on delete cascade,
  seat int not null,
  round int not null default 1,
  value numeric not null default 0,       -- single 1-10 score
  by_name text default '',
  created_at timestamptz default now()
);

-- Upgrade path from v1 (which had dims/total and a 2-col unique key):
alter table scores add column if not exists round int not null default 1;
alter table scores add column if not exists value numeric;
-- If upgrading from v1, copy old "total" into "value" where value is null.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_name='scores' and column_name='total') then
    update scores set value = total where value is null;
  end if;
end $$;
alter table scores alter column value set default 0;
update scores set value = 0 where value is null;
alter table scores alter column value set not null;

-- Drop any old 2-column unique constraint, add the 3-column one.
do $$
declare r record;
begin
  for r in (select conname from pg_constraint
            where conrelid = 'scores'::regclass and contype = 'u') loop
    execute 'alter table scores drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;
alter table scores add constraint scores_unique_seat_round unique (contestant_id, seat, round);

-- ---------- Contest state (single row holding the current round) ----------
create table if not exists contest_state (
  id int primary key default 1,
  current_round int not null default 1,
  updated_at timestamptz default now()
);
insert into contest_state (id, current_round)
values (1, 1)
on conflict (id) do nothing;

-- ---------- Row Level Security ----------
alter table contestants enable row level security;
alter table scores enable row level security;
alter table contest_state enable row level security;

-- Contestants: read / insert / update(advance flags) / delete allowed.
drop policy if exists contestants_read on contestants;
create policy contestants_read on contestants for select using (true);
drop policy if exists contestants_insert on contestants;
create policy contestants_insert on contestants for insert with check (true);
drop policy if exists contestants_update on contestants;
create policy contestants_update on contestants for update using (true) with check (true);
drop policy if exists contestants_delete on contestants;
create policy contestants_delete on contestants for delete using (true);

-- Scores: read + insert only. No update/delete => a submitted score is locked.
-- (Removed on contestant delete via cascade; reset deletes contestants.)
drop policy if exists scores_read on scores;
create policy scores_read on scores for select using (true);
drop policy if exists scores_insert on scores;
create policy scores_insert on scores for insert with check (true);

-- Contest state: read + update (admin advances the round in-app via ADMIN_CODE).
drop policy if exists state_read on contest_state;
create policy state_read on contest_state for select using (true);
drop policy if exists state_update on contest_state;
create policy state_update on contest_state for update using (true) with check (true);
