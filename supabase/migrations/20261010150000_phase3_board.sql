-- Phase 3: board counts, search and streak.

-- ts_headline needs plain text, and search_text is a tsvector. The extractor already hands
-- store_note the plain string, so keep it next to the vector.
alter table public.notes add column search_plain text;

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

-- Filter chip counts for one space (security invoker: RLS decides what is visible).
create function public.space_kind_counts(p_space uuid) returns table (kind text, note_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select n.kind, count(*)::bigint
  from public.notes n
  where n.space_id = p_space and n.deleted_at is null
  group by n.kind;
$$;

-- Search across every space the caller can see (SPEC 9.8).
create function public.search_notes(p_query text, p_limit integer default 20)
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
           coalesce(nullif(n.search_plain, ''), n.preview_text, n.title),
           websearch_to_tsquery('english', q.raw),
           'StartSel=<<,StopSel=>>,MaxWords=18,MinWords=6,MaxFragments=1'
         ) as snippet,
         n.updated_at
  from public.notes n, q
  where n.deleted_at is null
    and q.raw <> ''
    and (
      n.search_text @@ q.tsq
      or n.transcript_tsv @@ q.tsq
      or n.title operator(extensions.%) q.raw
    )
  order by
    ts_rank(coalesce(n.search_text, ''::tsvector), q.tsq) desc,
    n.updated_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Current streak in the caller's local days. Alive if there is activity today or yesterday.
create function public.current_streak() returns table (streak integer, active_today boolean)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tz text;
  v_today date;
  v_anchor date;
  v_active boolean := false;
  v_n integer;
begin
  select p.timezone into v_tz from public.profiles p where p.id = v_user;
  begin
    v_today := (now() at time zone coalesce(v_tz, 'UTC'))::date;
  exception when others then
    v_today := (now() at time zone 'UTC')::date;
  end;

  if exists (select 1 from public.note_activity a where a.user_id = v_user and a.day = v_today) then
    v_anchor := v_today;
    v_active := true;
  elsif exists (
    select 1 from public.note_activity a where a.user_id = v_user and a.day = v_today - 1
  ) then
    v_anchor := v_today - 1;
  else
    return query select 0, false;
    return;
  end if;

  -- consecutive days share day + row_number, so the run ending at the anchor has key anchor + 1
  select count(*)::integer into v_n
  from (
    select a.day + (row_number() over (order by a.day desc))::integer as run_key
    from public.note_activity a
    where a.user_id = v_user and a.day <= v_anchor
  ) runs
  where runs.run_key = v_anchor + 1;

  return query select v_n, v_active;
end;
$$;

grant execute on function public.space_kind_counts(uuid) to authenticated;
grant execute on function public.search_notes(text, integer) to authenticated;
grant execute on function public.current_streak() to authenticated;
