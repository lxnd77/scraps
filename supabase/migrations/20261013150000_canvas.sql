-- Canvas board (feedback round, Oct 13): every scrap can sit anywhere on its space's board,
-- snapped to a grid, and spaces get free-floating stickers.
--
--   * notes.board_pos is {x, y} in grid cells; null means "not placed yet" and the client flows
--     the card into a fixed masonry block. It is metadata, so it joins field-level last write wins.
--   * set_board_positions places many cards in one call (the first drag freezes a whole layout).
--     It runs as the caller, so RLS and the LWW trigger still decide every row.
--   * board_stickers: decoration only, no content. Members see them, editors change them.

alter table public.notes add column board_pos jsonb;
alter table public.notes add constraint notes_board_pos_shape check (
  board_pos is null or (
    jsonb_typeof(board_pos) = 'object'
    and jsonb_typeof(board_pos -> 'x') = 'number'
    and jsonb_typeof(board_pos -> 'y') = 'number'
    and (board_pos ->> 'x')::numeric = trunc((board_pos ->> 'x')::numeric)
    and (board_pos ->> 'y')::numeric = trunc((board_pos ->> 'y')::numeric)
    and abs((board_pos ->> 'x')::numeric) <= 100000
    and abs((board_pos ->> 'y')::numeric) <= 100000
  )
);

-- Same as 20261010140000_field_level_lww.sql with board_pos added to the fields.
create or replace function public.notes_meta_lww() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  fields constant text[] := array[
    'color', 'icon_sticker', 'cover', 'pinned', 'space_id', 'deleted_at', 'props', 'board_pos'
  ];
  f text;
  incoming timestamptz := new.meta_updated_at;
  stored timestamptz;
  clock jsonb := old.meta_clock;
  revert jsonb := '{}'::jsonb;
  changed boolean := false;
  accepted boolean := false;
begin
  foreach f in array fields loop
    if (to_jsonb(new) -> f) is distinct from (to_jsonb(old) -> f) then
      changed := true;
    end if;
  end loop;
  if not changed then
    -- content store or a no-op write: leave the clocks alone
    new.meta_updated_at := old.meta_updated_at;
    new.meta_clock := old.meta_clock;
    return new;
  end if;
  -- a client that sent no new timestamp is stamped by the server
  if incoming is not distinct from old.meta_updated_at then
    incoming := now();
  end if;
  foreach f in array fields loop
    if (to_jsonb(new) -> f) is distinct from (to_jsonb(old) -> f) then
      stored := (old.meta_clock ->> f)::timestamptz;
      if stored is not null and incoming < stored then
        -- a newer write already set this field: keep it
        revert := revert || jsonb_build_object(f, to_jsonb(old) -> f);
      else
        clock := clock || jsonb_build_object(f, incoming);
        accepted := true;
      end if;
    end if;
  end loop;
  if revert <> '{}'::jsonb then
    new := jsonb_populate_record(new, revert);
  end if;
  new.meta_clock := clock;
  new.meta_updated_at := case when accepted then greatest(old.meta_updated_at, incoming)
                              else old.meta_updated_at end;
  return new;
end;
$$;

-- Places many cards at once: p_positions is [{"id": uuid, "x": int, "y": int}, ...].
-- Only cards still in p_space are touched; RLS (security invoker) decides the rest.
create function public.set_board_positions(
  p_space uuid,
  p_positions jsonb,
  p_at timestamptz default now()
) returns integer
language sql
security invoker
set search_path = ''
as $$
  with incoming as (
    select (item ->> 'id')::uuid as id,
           jsonb_build_object('x', (item ->> 'x')::int, 'y', (item ->> 'y')::int) as pos
    from jsonb_array_elements(p_positions) as item
    limit 2000
  ), moved as (
    update public.notes n
    set board_pos = incoming.pos, meta_updated_at = p_at
    from incoming
    where n.id = incoming.id and n.space_id = p_space
    returning n.id
  )
  select count(*)::int from moved;
$$;

create table public.board_stickers (
  id uuid primary key default gen_random_uuid(), -- clients generate v7 ids so offline ones keep them
  space_id uuid not null references public.spaces (id) on delete cascade,
  sticker text not null check (sticker ~ '^[a-z0-9-]{1,40}$'),
  x real not null default 0 check (abs(x) <= 2400000),
  y real not null default 0 check (abs(y) <= 2400000),
  scale real not null default 1 check (scale between 0.5 and 3),
  rotation real not null default 0 check (rotation between -180 and 180),
  z integer not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index board_stickers_space_idx on public.board_stickers (space_id);
create trigger board_stickers_set_updated_at before update on public.board_stickers
  for each row execute function public.set_updated_at();

alter table public.board_stickers enable row level security;
create policy board_stickers_select on public.board_stickers for select to authenticated
  using (public.space_role(space_id) is not null);
create policy board_stickers_insert on public.board_stickers for insert to authenticated
  with check (public.space_role(space_id) in ('owner', 'editor'));
create policy board_stickers_update on public.board_stickers for update to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'))
  with check (public.space_role(space_id) in ('owner', 'editor'));
create policy board_stickers_delete on public.board_stickers for delete to authenticated
  using (public.space_role(space_id) in ('owner', 'editor'));

alter publication supabase_realtime add table public.board_stickers;
-- deletes carry the whole old row, so subscribers filtered by space_id still hear about them
alter table public.board_stickers replica identity full;

revoke execute on function public.set_board_positions(uuid, jsonb, timestamptz) from public, anon;
grant execute on function public.set_board_positions(uuid, jsonb, timestamptz) to authenticated;
