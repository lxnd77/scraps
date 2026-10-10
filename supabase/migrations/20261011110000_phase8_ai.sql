-- Phase 8: transcription and AI auto-sort.
--   * ai_rate + use_ai_slot: 60 suggestion calls per user per hour (service role only)
--   * assets in the Realtime publication so the voice block sees its transcript arrive
--   * profiles.ai_prompted_at: the one-time opt-in prompt has been answered
--   * guard trigger: clients can never write transcript or transcript_status
--   * pg_net hook: a new audio asset calls the transcribe-audio Edge Function
--   * card excerpt: notes.preview.voice.excerpt follows the transcript and survives stores

-- ---------------------------------------------------------------------------
-- rate limit for ai-sort
-- ---------------------------------------------------------------------------

create table public.ai_rate (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  window_start timestamptz not null,
  hits integer not null default 0
);

alter table public.ai_rate enable row level security;
revoke all on public.ai_rate from public, anon, authenticated;

-- true while the person is inside their 60 calls for the current fixed hour
create function public.use_ai_slot(p_user uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.ai_rate (user_id, window_start, hits)
  values (p_user, now(), 1)
  on conflict (user_id) do update
    set window_start = case
          when public.ai_rate.window_start < now() - interval '1 hour' then now()
          else public.ai_rate.window_start end,
        hits = case
          when public.ai_rate.window_start < now() - interval '1 hour' then 1
          else public.ai_rate.hits + 1 end
  returning hits into v_hits;
  return v_hits <= 60;
end;
$$;

revoke all on function public.use_ai_slot(uuid) from public, anon, authenticated;
grant execute on function public.use_ai_slot(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- profile flag, suggestions index, realtime
-- ---------------------------------------------------------------------------

alter table public.profiles add column ai_prompted_at timestamptz;

create index ai_suggestions_note_idx on public.ai_suggestions (note_id);

alter publication supabase_realtime add table public.assets;

-- ---------------------------------------------------------------------------
-- transcript guard: only the service role (and the database owner) writes these columns
-- ---------------------------------------------------------------------------

create function public.assets_guard_transcript() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if coalesce((select auth.role()), '') in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.transcript := null;
      new.transcript_status := case when new.kind = 'audio' then 'pending' else 'none' end;
    elsif new.transcript is distinct from old.transcript
       or new.transcript_status is distinct from old.transcript_status then
      raise exception 'transcripts are written by the server' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger assets_guard_transcript before insert or update on public.assets
  for each row execute function public.assets_guard_transcript();

-- ---------------------------------------------------------------------------
-- webhook: new audio asset -> transcribe-audio
-- ---------------------------------------------------------------------------

create extension if not exists pg_net;

-- Service role only. Keys: functions_url (…/functions/v1), internal_secret, functions_apikey
-- (optional gateway key, the local Kong wants one). Seeded in supabase/seed.sql for local
-- development; set by hand on the hosted project.
create table public.app_config (
  key text primary key,
  value text not null
);

alter table public.app_config enable row level security;
revoke all on public.app_config from public, anon, authenticated;

create function public.assets_transcribe_hook() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_key text;
begin
  select value into v_url from public.app_config where key = 'functions_url';
  select value into v_secret from public.app_config where key = 'internal_secret';
  select value into v_key from public.app_config where key = 'functions_apikey';

  -- unconfigured (or the call fails): the row stays pending and the backfill picks it up
  if v_url is null or v_secret is null then
    return null;
  end if;

  begin
    perform net.http_post(
      url := v_url || '/transcribe-audio',
      body := jsonb_build_object('assetId', new.id),
      headers := jsonb_strip_nulls(jsonb_build_object(
        'content-type', 'application/json',
        'x-internal-secret', v_secret,
        'apikey', v_key
      ))
    );
  exception when others then
    null; -- never fail the asset insert because the hook could not be queued
  end;
  return null;
end;
$$;

create trigger assets_transcribe_hook after insert on public.assets
  for each row when (new.kind = 'audio')
  execute function public.assets_transcribe_hook();

-- ---------------------------------------------------------------------------
-- card excerpt: preview.voice.excerpt
-- ---------------------------------------------------------------------------

-- The collab server rewrites notes.preview on every store, so the excerpt is merged back in by
-- store_note as well as by the transcript trigger below.
create or replace function public.store_note(
  p_note uuid,
  p_ydoc text,
  p_title text,
  p_preview_text text,
  p_kind text,
  p_word_count integer,
  p_preview jsonb,
  p_search text,
  p_edited_by uuid
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz text;
  v_day date;
begin
  insert into public.note_docs (note_id, ydoc, updated_at)
  values (p_note, decode(p_ydoc, 'hex'), now())
  on conflict (note_id) do update set ydoc = excluded.ydoc, updated_at = now();

  update public.notes
  set title = left(p_title, 120),
      preview_text = left(p_preview_text, 280),
      kind = p_kind,
      word_count = p_word_count,
      preview = p_preview,
      search_plain = left(coalesce(p_search, ''), 20000),
      search_text = to_tsvector('english', coalesce(p_search, ''))
                    || to_tsvector('simple', coalesce(p_search, '')),
      updated_at = now(),
      last_edited_by = coalesce(p_edited_by, last_edited_by)
  where id = p_note;

  -- keep the transcript excerpt on the card
  update public.notes n
  set preview = jsonb_set(n.preview, '{voice,excerpt}', to_jsonb(left(a.transcript, 140)))
  from public.assets a
  where n.id = p_note
    and a.note_id = p_note
    and n.preview #>> '{voice,assetId}' = a.id::text
    and a.transcript is not null
    and a.transcript <> '';

  if p_edited_by is not null then
    select p.timezone into v_tz from public.profiles p where p.id = p_edited_by;
    begin
      v_day := (now() at time zone coalesce(v_tz, 'UTC'))::date;
    exception when others then
      v_day := (now() at time zone 'UTC')::date; -- unknown timezone name
    end;
    insert into public.note_activity (user_id, day)
    values (p_edited_by, v_day)
    on conflict do nothing;
  end if;
end;
$$;

create function public.assets_sync_excerpt() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notes n
  set preview = jsonb_set(n.preview, '{voice,excerpt}', to_jsonb(left(new.transcript, 140)))
  where n.id = new.note_id
    and n.preview #>> '{voice,assetId}' = new.id::text
    and new.transcript is not null
    and new.transcript <> '';
  return null;
end;
$$;

create trigger assets_sync_excerpt after update of transcript on public.assets
  for each row execute function public.assets_sync_excerpt();
