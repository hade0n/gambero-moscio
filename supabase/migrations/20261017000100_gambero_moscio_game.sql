-- =============================================================================
-- Migration: 20261017000100_gambero_moscio_game.sql
-- Feature:   Gambero Moscio — Gioco Co-Op nel Browser ("Banco del Gambero")
-- Note:      Migrazione additiva. Non modifica in alcun modo la tabella `places`
--            né il bucket `locali` dell'app di recensioni.
-- =============================================================================

create table if not exists public.game_rooms (
  id             uuid        primary key default gen_random_uuid(),
  code           text        not null unique,
  status         text        not null default 'lobby'
                             check (status in ('lobby', 'playing', 'finished', 'expired')),
  host_player_id text        not null,
  seed           integer     not null,
  version        integer     not null default 1,
  realtime_topic text        not null,
  game_state     jsonb       not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  started_at     timestamptz,
  finished_at    timestamptz,
  expires_at     timestamptz not null
);

create index if not exists idx_game_rooms_code
  on public.game_rooms (code);

create index if not exists idx_game_rooms_expires_at
  on public.game_rooms (expires_at);

create table if not exists public.game_players (
  id             text        primary key,
  room_id        uuid        not null references public.game_rooms(id) on delete cascade,
  nickname       text        not null,
  avatar         jsonb       not null default '{}'::jsonb,
  token_hash     text        not null,
  is_host        boolean     not null default false,
  is_ready       boolean     not null default false,
  connected      boolean     not null default true,
  contributions  jsonb       not null default '{}'::jsonb,
  joined_at      timestamptz not null default now(),
  last_seen_at   timestamptz not null default now()
);

create index if not exists idx_game_players_room_id
  on public.game_players (room_id);

-- Row Level Security attiva: nessuna lettura o scrittura diretta anonima sulle
-- tabelle di stato. Tutte le operazioni canoniche passano dalle Vercel Functions
-- (/api/game/*) che validano il token partecipante lato server.
alter table public.game_rooms enable row level security;
alter table public.game_players enable row level security;

-- Funzione di manutenzione per ripulire le lobby scadute o inattive
create or replace function public.cleanup_expired_game_rooms()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  with removed as (
    delete from public.game_rooms
     where expires_at < now()
    returning id
  )
  select count(*) into deleted_count from removed;
  return coalesce(deleted_count, 0);
end;
$$;
