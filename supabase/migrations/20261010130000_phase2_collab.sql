-- Phase 2: functions the collab server (service role) uses, and note property chips.

-- "vibe" and "when" chips on a note (SPEC 6.3). Tags live in tags / note_tags.
alter table public.notes add column props jsonb not null default '{}'::jsonb;

-- props is metadata: it takes part in last-write-wins like colour and pin
create or replace function public.notes_meta_lww() returns trigger
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
    new.props := old.props;
    new.meta_updated_at := old.meta_updated_at;
  elsif new.meta_updated_at is not distinct from old.meta_updated_at
    and (new.color is distinct from old.color
      or new.icon_sticker is distinct from old.icon_sticker
      or new.cover is distinct from old.cover
      or new.pinned is distinct from old.pinned
      or new.space_id is distinct from old.space_id
      or new.deleted_at is distinct from old.deleted_at
      or new.props is distinct from old.props) then
    new.meta_updated_at := now();
  end if;
  return new;
end;
$$;

-- The caller's role on a note, or null. Null for deleted notes and spaces.
create function public.note_access(p_note uuid, p_user uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.notes n
  join public.spaces s on s.id = n.space_id
  join public.space_members m on m.space_id = n.space_id and m.user_id = p_user
  where n.id = p_note and n.deleted_at is null and s.deleted_at is null;
$$;

create function public.space_access(p_space uuid, p_user uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.spaces s
  join public.space_members m on m.space_id = s.id and m.user_id = p_user
  where s.id = p_space and s.deleted_at is null;
$$;

-- One transaction per store: the document, the card fields, full-text search and the streak day.
-- p_ydoc is hex so it travels as plain text through PostgREST.
create function public.store_note(
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
      search_text = to_tsvector('english', coalesce(p_search, ''))
                    || to_tsvector('simple', coalesce(p_search, '')),
      updated_at = now(),
      last_edited_by = coalesce(p_edited_by, last_edited_by)
  where id = p_note;

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

-- service role only: none of these may be called with a user's token
revoke all on function public.note_access(uuid, uuid) from public, anon, authenticated;
revoke all on function public.space_access(uuid, uuid) from public, anon, authenticated;
revoke all on function public.store_note(uuid, text, text, text, text, integer, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.note_access(uuid, uuid) to service_role;
grant execute on function public.space_access(uuid, uuid) to service_role;
grant execute on function public.store_note(uuid, text, text, text, text, integer, jsonb, text, uuid)
  to service_role;
