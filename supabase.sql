/* =====================================================
   РАСТЕНИЯ ПРОТИВ ЗОМБИ — СХЕМА БАЗЫ ДАННЫХ
   Выполни этот SQL в Supabase SQL Editor
   (Dashboard → SQL Editor → New query → Run)

   Скрипт идемпотентный: его можно запускать повторно.
===================================================== */

-- =====================================================
-- PROFILES
-- =====================================================

create table if not exists public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    username text not null unique,
    unlocked_level int not null default 1,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
    on public.profiles for select
    to authenticated
    using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
    on public.profiles for insert
    to authenticated
    with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
    on public.profiles for update
    to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

-- =====================================================
-- LOBBIES
-- =====================================================

create table if not exists public.lobbies (
    id uuid primary key default gen_random_uuid(),
    host_id uuid not null references public.profiles(id) on delete cascade,
    difficulty text not null default 'easy',
    status text not null default 'waiting'
        check (status in ('waiting', 'playing', 'finished')),
    created_at timestamptz not null default now()
);

alter table public.lobbies enable row level security;

drop policy if exists "lobbies_select_all" on public.lobbies;
create policy "lobbies_select_all"
    on public.lobbies for select
    to authenticated
    using (true);

drop policy if exists "lobbies_insert_own" on public.lobbies;
create policy "lobbies_insert_own"
    on public.lobbies for insert
    to authenticated
    with check ((select auth.uid()) = host_id);

drop policy if exists "lobbies_update_host" on public.lobbies;
create policy "lobbies_update_host"
    on public.lobbies for update
    to authenticated
    using ((select auth.uid()) = host_id)
    with check ((select auth.uid()) = host_id);

drop policy if exists "lobbies_delete_host" on public.lobbies;
create policy "lobbies_delete_host"
    on public.lobbies for delete
    to authenticated
    using ((select auth.uid()) = host_id);

-- =====================================================
-- LOBBY PLAYERS
-- =====================================================

create table if not exists public.lobby_players (
    id uuid primary key default gen_random_uuid(),
    lobby_id uuid not null references public.lobbies(id) on delete cascade,
    user_id uuid not null references public.profiles(id) on delete cascade,
    username text not null,
    player_color text not null default 'red'
        check (player_color in ('red', 'yellow', 'green', 'blue')),
    ready boolean not null default false,
    last_seen timestamptz not null default now(),
    joined_at timestamptz not null default now(),
    unique (lobby_id, user_id)
);

alter table public.lobby_players
    add column if not exists last_seen timestamptz not null default now();

-- Убираем старые "призрачные" записи перед включением строгих правил.
delete from public.lobby_players lp
using public.lobby_players newer_lp,
      public.lobbies l,
      public.lobbies newer_l
where l.id = lp.lobby_id
  and newer_l.id = newer_lp.lobby_id
  and l.status = 'waiting'
  and newer_l.status = 'waiting'
  and lp.user_id = newer_lp.user_id
  and lp.ctid <> newer_lp.ctid
  and (
      newer_lp.last_seen > lp.last_seen
      or (
          newer_lp.last_seen = lp.last_seen
          and newer_lp.joined_at > lp.joined_at
      )
      or (
          newer_lp.last_seen = lp.last_seen
          and newer_lp.joined_at = lp.joined_at
          and newer_lp.id::text > lp.id::text
      )
  );

delete from public.lobby_players lp
using public.lobby_players keep_lp
where lp.lobby_id = keep_lp.lobby_id
  and lp.player_color = keep_lp.player_color
  and lp.ctid <> keep_lp.ctid
  and (
      keep_lp.joined_at < lp.joined_at
      or (
          keep_lp.joined_at = lp.joined_at
          and keep_lp.id::text < lp.id::text
      )
  );

update public.lobbies l
set status = 'finished'
where l.status = 'waiting'
  and not exists (
      select 1
      from public.lobby_players lp
      where lp.lobby_id = l.id
  );

create unique index if not exists lobby_players_lobby_color_unique
    on public.lobby_players(lobby_id, player_color);

alter table public.lobby_players enable row level security;

create or replace function public.enforce_lobby_player_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    if tg_op = 'INSERT' then
        if exists (
            select 1
            from public.lobby_players lp
            join public.lobbies l on l.id = lp.lobby_id
            where lp.user_id = new.user_id
              and lp.lobby_id <> new.lobby_id
              and l.status = 'waiting'
        ) then
            raise exception 'Player is already in a waiting lobby';
        end if;

        if (
            select count(*)
            from public.lobby_players lp
            where lp.lobby_id = new.lobby_id
        ) >= 4 then
            raise exception 'Lobby is full';
        end if;

        return new;
    end if;

    if tg_op = 'UPDATE' then
        if new.id <> old.id
            or new.lobby_id <> old.lobby_id
            or new.user_id <> old.user_id
            or new.username <> old.username
            or new.joined_at <> old.joined_at then
            raise exception 'Only ready, player_color and last_seen can be changed';
        end if;

        return new;
    end if;

    return new;
end;
$$;

revoke all on function public.enforce_lobby_player_rules() from public;

drop trigger if exists enforce_lobby_player_rules_trigger on public.lobby_players;
create trigger enforce_lobby_player_rules_trigger
    before insert or update on public.lobby_players
    for each row execute function public.enforce_lobby_player_rules();

create or replace function public.join_lobby(
    p_lobby_id uuid,
    p_username text
)
returns public.lobby_players
language plpgsql
security definer
set search_path = public
as $$
declare
    v_user_id uuid := auth.uid();
    v_lobby public.lobbies;
    v_existing public.lobby_players;
    v_color text;
    v_player public.lobby_players;
begin
    if v_user_id is null then
        raise exception 'Not authenticated';
    end if;

    select *
    into v_lobby
    from public.lobbies
    where id = p_lobby_id
      and status = 'waiting';

    if not found then
        raise exception 'Lobby is not available';
    end if;

    select *
    into v_existing
    from public.lobby_players
    where lobby_id = p_lobby_id
      and user_id = v_user_id;

    if found then
        update public.lobby_players
        set last_seen = now()
        where id = v_existing.id
        returning * into v_player;

        return v_player;
    end if;

    delete from public.lobby_players lp
    using public.lobbies l
    where l.id = lp.lobby_id
      and l.status = 'waiting'
      and lp.user_id = v_user_id
      and lp.username = p_username
      and lp.lobby_id <> p_lobby_id;

    if (
        select count(*)
        from public.lobby_players
        where lobby_id = p_lobby_id
    ) >= 4 then
        raise exception 'Lobby is full';
    end if;

    select color
    into v_color
    from unnest(array['red', 'yellow', 'green', 'blue']) as color
    where not exists (
        select 1
        from public.lobby_players lp
        where lp.lobby_id = p_lobby_id
          and lp.player_color = color
    )
    limit 1;

    if v_color is null then
        raise exception 'No free player color';
    end if;

    insert into public.lobby_players (
        lobby_id,
        user_id,
        username,
        player_color,
        ready,
        last_seen
    )
    values (
        p_lobby_id,
        v_user_id,
        p_username,
        v_color,
        false,
        now()
    )
    returning * into v_player;

    return v_player;
end;
$$;

revoke all on function public.join_lobby(uuid, text) from public;
grant execute on function public.join_lobby(uuid, text) to authenticated;

create or replace function public.get_lobby_players(
    p_lobby_id uuid
)
returns setof public.lobby_players
language sql
security definer
set search_path = public
as $$
    select lp.*
    from public.lobby_players lp
    join public.lobbies l on l.id = lp.lobby_id
    where lp.lobby_id = p_lobby_id
      and l.status <> 'finished'
    order by lp.joined_at asc;
$$;

revoke all on function public.get_lobby_players(uuid) from public;
grant execute on function public.get_lobby_players(uuid) to authenticated;

-- Игроки в ожидающих лобби видны всем (для списка онлайн-игроков),
-- свои строки видны всегда. Без самоссылки на lobby_players,
-- чтобы не было infinite recursion.
drop policy if exists "lobby_players_select" on public.lobby_players;
create policy "lobby_players_select"
    on public.lobby_players for select
    to authenticated
    using (
        (select auth.uid()) = user_id
        or exists (
            select 1
            from public.lobbies l
            where l.id = lobby_players.lobby_id
              and l.status = 'waiting'
        )
    );

-- Любой авторизованный может войти в лобби
drop policy if exists "lobby_players_insert" on public.lobby_players;
create policy "lobby_players_insert"
    on public.lobby_players for insert
    to authenticated
    with check (
        (select auth.uid()) = user_id
        and exists (
            select 1
            from public.lobbies l
            where l.id = lobby_players.lobby_id
              and l.status = 'waiting'
        )
    );

-- Игрок может менять только свою готовность и цвет
drop policy if exists "lobby_players_update_own" on public.lobby_players;
create policy "lobby_players_update_own"
    on public.lobby_players for update
    to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

-- Игрок выходит сам, или хост удаляет игроков
drop policy if exists "lobby_players_delete" on public.lobby_players;
create policy "lobby_players_delete"
    on public.lobby_players for delete
    to authenticated
    using (
        (select auth.uid()) = user_id
        or exists (
            select 1
            from public.lobbies
            where id = lobby_id
              and host_id = (select auth.uid())
        )
    );

-- =====================================================
-- LOBBY INVITES
-- =====================================================

create table if not exists public.lobby_invites (
    id uuid primary key default gen_random_uuid(),
    lobby_id uuid not null references public.lobbies(id) on delete cascade,
    from_user_id uuid not null references public.profiles(id) on delete cascade,
    from_username text not null,
    to_user_id uuid not null references public.profiles(id) on delete cascade,
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'declined')),
    created_at timestamptz not null default now()
);

alter table public.lobby_invites enable row level security;

create unique index if not exists lobby_invites_one_pending_unique
    on public.lobby_invites(lobby_id, from_user_id, to_user_id)
    where status = 'pending';

drop policy if exists "lobby_invites_select_related" on public.lobby_invites;
create policy "lobby_invites_select_related"
    on public.lobby_invites for select
    to authenticated
    using (
        (select auth.uid()) = from_user_id
        or (select auth.uid()) = to_user_id
    );

drop policy if exists "lobby_invites_insert_lobby_member" on public.lobby_invites;
create policy "lobby_invites_insert_lobby_member"
    on public.lobby_invites for insert
    to authenticated
    with check (
        (select auth.uid()) = from_user_id
        and exists (
            select 1
            from public.lobby_players lp
            join public.lobbies l on l.id = lp.lobby_id
            where lp.lobby_id = lobby_invites.lobby_id
              and lp.user_id = (select auth.uid())
              and l.status = 'waiting'
        )
    );

drop policy if exists "lobby_invites_update_recipient" on public.lobby_invites;
create policy "lobby_invites_update_recipient"
    on public.lobby_invites for update
    to authenticated
    using ((select auth.uid()) = to_user_id)
    with check ((select auth.uid()) = to_user_id);

drop policy if exists "lobby_invites_delete_sender_or_recipient" on public.lobby_invites;
create policy "lobby_invites_delete_sender_or_recipient"
    on public.lobby_invites for delete
    to authenticated
    using (
        (select auth.uid()) = from_user_id
        or (select auth.uid()) = to_user_id
    );

-- =====================================================
-- INFINITE SAVES
-- =====================================================

create table if not exists public.infinite_saves (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    slot int not null check (slot between 1 and 3),
    save_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, slot)
);

alter table public.infinite_saves enable row level security;

drop policy if exists "infinite_saves_select_own" on public.infinite_saves;
create policy "infinite_saves_select_own"
    on public.infinite_saves for select
    using (auth.uid() = user_id);

drop policy if exists "infinite_saves_insert_own" on public.infinite_saves;
create policy "infinite_saves_insert_own"
    on public.infinite_saves for insert
    with check (auth.uid() = user_id);

drop policy if exists "infinite_saves_update_own" on public.infinite_saves;
create policy "infinite_saves_update_own"
    on public.infinite_saves for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

drop policy if exists "infinite_saves_delete_own" on public.infinite_saves;
create policy "infinite_saves_delete_own"
    on public.infinite_saves for delete
    using (auth.uid() = user_id);

-- =====================================================
-- REALTIME
-- =====================================================

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'lobbies'
    ) then
        alter publication supabase_realtime add table public.lobbies;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'lobby_players'
    ) then
        alter publication supabase_realtime add table public.lobby_players;
    end if;

    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'lobby_invites'
    ) then
        alter publication supabase_realtime add table public.lobby_invites;
    end if;
end $$;

-- =====================================================
-- INDEXES
-- =====================================================

create index if not exists idx_lobbies_status
    on public.lobbies(status);

create index if not exists idx_lobbies_difficulty
    on public.lobbies(difficulty);

create index if not exists idx_lobby_players_lobby
    on public.lobby_players(lobby_id);

create index if not exists idx_lobby_players_user
    on public.lobby_players(user_id);

create index if not exists idx_lobby_invites_to_user
    on public.lobby_invites(to_user_id, status);

create index if not exists idx_infinite_saves_user
    on public.infinite_saves(user_id);
