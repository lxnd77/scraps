-- Field-level last-write-wins for note metadata.
--
-- The Phase 1 trigger compared one clock for the whole row, so two quick writes to different
-- fields (colour, then pin) that arrived out of order lost the older one entirely. Each field now
-- carries its own clock in meta_clock; a write only loses on the fields where a newer write
-- already landed. meta_updated_at stays as the row-level "latest metadata write".

alter table public.notes add column meta_clock jsonb not null default '{}'::jsonb;

create or replace function public.notes_meta_lww() returns trigger
language plpgsql
set search_path = ''
as $$
declare
  fields constant text[] := array[
    'color', 'icon_sticker', 'cover', 'pinned', 'space_id', 'deleted_at', 'props'
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
