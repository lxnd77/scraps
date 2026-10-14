-- Cheaper saving (Oct 14 feedback).
--
-- 1. Search text moves out of `notes` into `note_search`. `notes` is in the realtime publication,
--    so every store sent each open board the whole row, up to 20 KB of search text and its
--    tsvector included, though boards only use the event to refetch. `note_search` is not
--    published.
-- 2. store_note splits in two, so the collab server can write the document on every debounced
--    store and the card fields (one `notes` update, one realtime event) only when they change, at
--    most every few seconds:
--      store_note_doc      the Yjs document and the streak day; never touches `notes`
--      store_note_preview  the card fields, the transcript excerpt and the search row
--    store_note stays, calling both, for a collab server still on the previous build.

-- ---------------------------------------------------------------------------
-- note_search
-- ---------------------------------------------------------------------------
create table public.note_search (
  note_id uuid primary key references public.notes (id) on delete cascade,
  search_plain text,
  search_text tsvector
);
create index note_search_text_idx on public.note_search using gin (search_text);

alter table public.note_search enable row level security;
-- readable exactly when the note is (the notes policy applies inside the subquery);
-- written only by store_note_preview, a security definer function
create policy note_search_select on public.note_search for select to authenticated
  using (exists (select 1 from public.notes n where n.id = note_id));
revoke insert, update, delete, truncate on public.note_search from anon, authenticated;

insert into public.note_search (note_id, search_plain, search_text)
select id, search_plain, search_text
from public.notes
where search_plain is not null or search_text is not null;

-- ---------------------------------------------------------------------------
-- search_notes reads note_search (same signature and results as before)
-- ---------------------------------------------------------------------------
create or replace function public.search_notes(p_query text, p_limit integer default 20)
returns table (
  id uuid,
  title text,
  kind text,
  color text,
  space_id uuid,
  pinned boolean,
  snippet text,
  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select left(btrim(p_query), 200) as raw,
           websearch_to_tsquery('english', left(btrim(p_query), 200))
           || websearch_to_tsquery('simple', left(btrim(p_query), 200)) as tsq
  )
  select n.id,
         n.title,
         n.kind,
         n.color,
         n.space_id,
         n.pinned,
         ts_headline(
           'english',
           coalesce(nullif(s.search_plain, ''), n.preview_text, n.title),
           websearch_to_tsquery('english', q.raw),
           'StartSel=<<,StopSel=>>,MaxWords=18,MinWords=6,MaxFragments=1'
         ) as snippet,
         n.updated_at
  from public.notes n
  cross join q
  left join public.note_search s on s.note_id = n.id
  where n.deleted_at is null
    and q.raw <> ''
    and (
      s.search_text @@ q.tsq
      or n.transcript_tsv @@ q.tsq
      or n.title operator(extensions.%) q.raw
    )
  order by
    ts_rank(coalesce(s.search_text, ''::tsvector), q.tsq) desc,
    n.updated_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- the split store
-- ---------------------------------------------------------------------------
create function public.store_note_doc(p_note uuid, p_ydoc text, p_edited_by uuid)
returns void
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

create function public.store_note_preview(
  p_note uuid,
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
begin
  update public.notes
  set title = left(p_title, 120),
      preview_text = left(p_preview_text, 280),
      kind = p_kind,
      word_count = p_word_count,
      preview = p_preview,
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

  insert into public.note_search (note_id, search_plain, search_text)
  select p_note,
         left(coalesce(p_search, ''), 20000),
         to_tsvector('english', coalesce(p_search, '')) || to_tsvector('simple', coalesce(p_search, ''))
  where exists (select 1 from public.notes where id = p_note)
  on conflict (note_id) do update
  set search_plain = excluded.search_plain, search_text = excluded.search_text;
end;
$$;

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
begin
  perform public.store_note_doc(p_note, p_ydoc, p_edited_by);
  perform public.store_note_preview(
    p_note, p_title, p_preview_text, p_kind, p_word_count, p_preview, p_search, p_edited_by
  );
end;
$$;

-- service role only, like store_note
revoke all on function public.store_note_doc(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.store_note_preview(uuid, text, text, text, integer, jsonb, text, uuid)
  from public, anon, authenticated;
grant execute on function public.store_note_doc(uuid, text, uuid) to service_role;
grant execute on function public.store_note_preview(uuid, text, text, text, integer, jsonb, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- the old columns go
-- ---------------------------------------------------------------------------
drop index if exists public.notes_search_text_idx;
alter table public.notes drop column search_plain, drop column search_text;
