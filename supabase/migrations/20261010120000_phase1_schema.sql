-- scraps. v1 schema (SPEC section 11.2 and 11.3).
-- Every table is created now so later phases add columns, not tables.
-- Plan-review decisions folded in (see docs/DECISIONS.md):
--   * notes.meta_updated_at is the last-write-wins clock for metadata, enforced here
--   * notes.transcript_tsv is separate from search_text and maintained by an assets trigger
--   * media storage paths are keyed by note id; policies resolve the note's current space

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- generic helpers
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 40),
  avatar_sticker text not null default 'smiley' check (
    avatar_sticker in ('smiley', 'sleepy-moon', 'heart', 'sparkle', 'lightning', 'flower',
                       'speech-bubble', 'planet', 'zzz', 'sun')
  ),
  theme text not null default 'auto' check (theme in ('day', 'midnight', 'auto')),
  tidy_mode boolean not null default false,
  ai_enabled boolean not null default false,
  timezone text not null default 'UTC',
  birth_year integer check (birth_year between 1900 and 2100),
  default_capture_space uuid,
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- a profile row appears for every auth user; onboarding fills in the rest
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''),
                  split_part(coalesce(new.email, ''), '@', 1)), 40)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- spaces and membership
-- ---------------------------------------------------------------------------

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  color text not null default 'yellow' check (
    color in ('yellow', 'lime', 'pink', 'blue', 'lilac', 'orange')
  ),
  icon_sticker text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger spaces_set_updated_at before update on public.spaces
  for each row execute function public.set_updated_at();

alter table public.profiles
  add constraint profiles_default_capture_space_fkey
  foreign key (default_capture_space) references public.spaces (id) on delete set null;

create table public.space_members (
  space_id uuid not null references public.spaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index space_members_user_id_idx on public.space_members (user_id);

-- the creator is always the first owner
create function public.add_space_owner() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.space_members (space_id, user_id, role)
  values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger spaces_add_owner after insert on public.spaces
  for each row execute function public.add_space_owner();

create table public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  token_hash text not null unique,
  role text not null check (role in ('editor', 'viewer')),
  created_by uuid not null references public.profiles (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses integer not null default 20 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index space_invites_space_id_idx on public.space_invites (space_id);

-- ---------------------------------------------------------------------------
-- role helpers (security definer, so policies can read membership without recursion)
-- ---------------------------------------------------------------------------

create function public.space_role(space uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.space_members m
  join public.spaces s on s.id = m.space_id
  where m.space_id = space
    and m.user_id = (select auth.uid())
    and s.deleted_at is null;
$$;

create function public.shares_space(other uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.space_members mine
    join public.space_members theirs on theirs.space_id = mine.space_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- notes
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(), -- clients generate v7 ids so offline notes keep them
  space_id uuid not null references public.spaces (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  last_edited_by uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'list', 'pic', 'link', 'voice', 'quote')),
  color text not null default 'yellow' check (
    color in ('yellow', 'lime', 'pink', 'blue', 'lilac', 'orange', 'surface')
  ),
  icon_sticker text,
  cover jsonb,
  title text not null default '',
  preview_text text not null default '',
  preview jsonb not null default '{}'::jsonb,
  word_count integer not null default 0,
  pinned boolean not null default false,
  search_text tsvector,
  transcript_tsv tsvector,
  meta_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index notes_board_idx on public.notes (space_id, pinned desc, updated_at desc)
  where deleted_at is null;
create index notes_search_text_idx on public.notes using gin (search_text);
create index notes_transcript_tsv_idx on public.notes using gin (transcript_tsv);
create index notes_title_trgm_idx on public.notes using gin (title extensions.gin_trgm_ops);

-- Metadata last-write-wins, enforced in the database so replayed outbox writes are safe.
--   stale write (older meta_updated_at)  -> metadata columns keep their current values
--   changed metadata, same timestamp     -> the clock moves to now()
-- Content stores from the collab server touch title/preview/updated_at and leave this alone.
create function public.notes_meta_lww() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.meta_updated_at < old.meta_updated_at then
    new.color := old.color;
    new.icon_sticker := old.icon_sticker;
    new.cover := old.cover;
    new.pinned := old.pinned;
    new.space_id := old.space_id;
    new.deleted_at := old.deleted_at;
    new.meta_updated_at := old.meta_updated_at;
  elsif new.meta_updated_at is not distinct from old.meta_updated_at
    and (new.color is distinct from old.color
      or new.icon_sticker is distinct from old.icon_sticker
      or new.cover is distinct from old.cover
      or new.pinned is distinct from old.pinned
      or new.space_id is distinct from old.space_id
      or new.deleted_at is distinct from old.deleted_at) then
    new.meta_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger notes_meta_lww before update on public.notes
  for each row execute function public.notes_meta_lww();

create function public.note_role(note uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select public.space_role(n.space_id) from public.notes n where n.id = note;
$$;

-- note content: service role only (the collab server). RLS on, no policies.
create table public.note_docs (
  note_id uuid primary key references public.notes (id) on delete cascade,
  ydoc bytea,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tags
-- ---------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  color text not null default 'lilac' check (
    color in ('yellow', 'lime', 'pink', 'blue', 'lilac', 'orange')
  )
);

create unique index tags_space_name_idx on public.tags (space_id, lower(name));

create table public.note_tags (
  note_id uuid not null references public.notes (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  primary key (note_id, tag_id)
);

create index note_tags_tag_id_idx on public.note_tags (tag_id);

-- ---------------------------------------------------------------------------
-- assets
-- ---------------------------------------------------------------------------

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  space_id uuid not null references public.spaces (id) on delete cascade,
  uploader_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('image', 'audio')),
  storage_path text not null,
  mime text not null,
  bytes integer not null default 0,
  width integer,
  height integer,
  dominant_color text,
  duration_ms integer,
  waveform jsonb,
  transcript text,
  transcript_status text not null default 'none' check (
    transcript_status in ('none', 'pending', 'done', 'failed')
  ),
  created_at timestamptz not null default now()
);

create index assets_note_id_idx on public.assets (note_id);

-- space_id always comes from the note, never from the client
create function public.assets_set_space() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  select n.space_id into new.space_id from public.notes n where n.id = new.note_id;
  return new;
end;
$$;

create trigger assets_set_space before insert on public.assets
  for each row execute function public.assets_set_space();

-- moving a note moves its assets' space with it
create function public.notes_sync_asset_space() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.assets set space_id = new.space_id where note_id = new.id;
  return new;
end;
$$;

create trigger notes_sync_asset_space after update of space_id on public.notes
  for each row when (old.space_id is distinct from new.space_id)
  execute function public.notes_sync_asset_space();

-- transcripts are searchable but never share a column with the extractor's search_text
create function public.assets_refresh_transcript() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.note_id, old.note_id);
  joined text;
begin
  select string_agg(a.transcript, ' ') into joined
  from public.assets a
  where a.note_id = target and a.transcript is not null and a.transcript <> '';
  update public.notes
  set transcript_tsv = case
    when joined is null then null
    else to_tsvector('english', joined) || to_tsvector('simple', joined)
  end
  where id = target;
  return null;
end;
$$;

create trigger assets_refresh_transcript after insert or delete or update of transcript
  on public.assets
  for each row execute function public.assets_refresh_transcript();

-- ---------------------------------------------------------------------------
-- previews, AI suggestions, capture tokens, activity
-- ---------------------------------------------------------------------------

create table public.link_previews (
  url_hash text primary key,
  url text not null,
  title text,
  description text,
  image_url text,
  site_name text,
  duration_s integer,
  fetched_at timestamptz not null default now()
);

create table public.ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  space_id uuid references public.spaces (id) on delete set null,
  tags text[] not null default '{}',
  title text,
  confidence real not null check (confidence between 0 and 1),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'dismissed')),
  model text,
  created_at timestamptz not null default now()
);

create index ai_suggestions_user_idx on public.ai_suggestions (user_id, status);

create table public.capture_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique,
  label text not null default '',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index capture_tokens_user_idx on public.capture_tokens (user_id);

create table public.note_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------------
-- counts for the sidebar (security invoker: RLS decides which notes are visible)
-- ---------------------------------------------------------------------------

create function public.space_note_counts() returns table (space_id uuid, note_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.space_id, count(*)::bigint
  from public.notes n
  where n.deleted_at is null
  group by n.space_id;
$$;

-- ---------------------------------------------------------------------------
-- row level security
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.spaces enable row level security;
alter table public.space_members enable row level security;
alter table public.space_invites enable row level security;
alter table public.notes enable row level security;
alter table public.note_docs enable row level security;
alter table public.tags enable row level security;
alter table public.note_tags enable row level security;
alter table public.assets enable row level security;
alter table public.link_previews enable row level security;
alter table public.ai_suggestions enable row level security;
alter table public.capture_tokens enable row level security;
alter table public.note_activity enable row level security;

-- profiles: your own row, and people you share a space with (for avatars and carets)
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_space(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- spaces
create policy spaces_select on public.spaces for select to authenticated
  using (owner_id = (select auth.uid()) or public.space_role(id) is not null);
create policy spaces_insert on public.spaces for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy spaces_update on public.spaces for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

-- space_members
create policy space_members_select on public.space_members for select to authenticated
  using (public.space_role(space_id) is not null);
create policy space_members_insert on public.space_members for insert to authenticated
  with check (
    public.space_role(space_id) = 'owner'
    or (public.space_role(space_id) = 'editor' and role = 'viewer')
  );
create policy space_members_update on public.space_members for update to authenticated
  using (public.space_role(space_id) = 'owner')
  with check (public.space_role(space_id) = 'owner');
create policy space_members_delete on public.space_members for delete to authenticated
  using (
    public.space_role(space_id) = 'owner' and user_id <> (select auth.uid())
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- space_invites
create policy space_invites_select on public.space_invites for select to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'));
create policy space_invites_insert on public.space_invites for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and (
      public.space_role(space_id) = 'owner'
      or (public.space_role(space_id) = 'editor' and role = 'viewer')
    )
  );
create policy space_invites_update on public.space_invites for update to authenticated
  using (public.space_role(space_id) = 'owner' or created_by = (select auth.uid()))
  with check (public.space_role(space_id) = 'owner' or created_by = (select auth.uid()));

-- notes: soft delete is an update of deleted_at. A move needs editor in both spaces:
-- USING checks the old row's space, WITH CHECK checks the new one.
create policy notes_select on public.notes for select to authenticated
  using (public.space_role(space_id) is not null);
create policy notes_insert on public.notes for insert to authenticated
  with check (
    public.space_role(space_id) in ('owner', 'editor')
    and created_by = (select auth.uid())
  );
create policy notes_update on public.notes for update to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'))
  with check (public.space_role(space_id) in ('owner', 'editor'));

-- note_docs: RLS enabled, deliberately no policies (service role only)

-- tags follow their space
create policy tags_select on public.tags for select to authenticated
  using (public.space_role(space_id) is not null);
create policy tags_insert on public.tags for insert to authenticated
  with check (public.space_role(space_id) in ('owner', 'editor'));
create policy tags_update on public.tags for update to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'))
  with check (public.space_role(space_id) in ('owner', 'editor'));
create policy tags_delete on public.tags for delete to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'));

-- note_tags follow the note, and the tag must live in the same space as the note
create policy note_tags_select on public.note_tags for select to authenticated
  using (public.note_role(note_id) is not null);
create policy note_tags_insert on public.note_tags for insert to authenticated
  with check (
    public.note_role(note_id) in ('owner', 'editor')
    and exists (
      select 1
      from public.tags t
      join public.notes n on n.id = note_tags.note_id
      where t.id = note_tags.tag_id and t.space_id = n.space_id
    )
  );
create policy note_tags_delete on public.note_tags for delete to authenticated
  using (public.note_role(note_id) in ('owner', 'editor'));

-- assets follow the note's space (space_id is set by trigger, never trusted from the client)
create policy assets_select on public.assets for select to authenticated
  using (public.space_role(space_id) is not null);
create policy assets_insert on public.assets for insert to authenticated
  with check (
    public.note_role(note_id) in ('owner', 'editor')
    and uploader_id = (select auth.uid())
  );
create policy assets_update on public.assets for update to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'))
  with check (public.space_role(space_id) in ('owner', 'editor'));
create policy assets_delete on public.assets for delete to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'));

-- link_previews: readable by signed-in users, written by the service role only
create policy link_previews_select on public.link_previews for select to authenticated
  using (true);

-- the owner of the row, and nobody else
create policy ai_suggestions_all on public.ai_suggestions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy capture_tokens_all on public.capture_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- note_activity: read your own streak; the collab server writes it
create policy note_activity_select on public.note_activity for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- privileges: helpers are for signed-in users only
-- ---------------------------------------------------------------------------

revoke execute on function public.space_role(uuid) from public, anon;
revoke execute on function public.note_role(uuid) from public, anon;
revoke execute on function public.shares_space(uuid) from public, anon;
revoke execute on function public.space_note_counts() from public, anon;
grant execute on function public.space_role(uuid) to authenticated;
grant execute on function public.note_role(uuid) to authenticated;
grant execute on function public.shares_space(uuid) to authenticated;
grant execute on function public.space_note_counts() to authenticated;

-- anonymous visitors have no table access at all
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- storage: private media bucket, first path segment is the note id
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 20971520)
on conflict (id) do nothing;

create function public.media_note_role(object_name text) returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return public.note_role(((storage.foldername(object_name))[1])::uuid);
exception when others then
  return null; -- first segment is not a uuid
end;
$$;

revoke execute on function public.media_note_role(text) from public, anon;
grant execute on function public.media_note_role(text) to authenticated;

create policy media_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.media_note_role(name) is not null);
create policy media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.media_note_role(name) in ('owner', 'editor'));
create policy media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.media_note_role(name) in ('owner', 'editor'))
  with check (bucket_id = 'media' and public.media_note_role(name) in ('owner', 'editor'));
create policy media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.media_note_role(name) in ('owner', 'editor'));
