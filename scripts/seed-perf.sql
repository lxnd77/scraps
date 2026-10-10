-- Perf seed: 5,000 scraps in a throwaway space owned by the first profile, for checking search speed.
-- Run:  docker exec -i supabase_db_Scraps psql -U postgres -f - < scripts/seed-perf.sql
-- Clean: delete from public.spaces where name = 'perf seed';
do $$
declare
  v_owner uuid := (select id from public.profiles order by created_at limit 1);
  v_space uuid := gen_random_uuid();
begin
  insert into public.spaces (id, owner_id, name) values (v_space, v_owner, 'perf seed');
  insert into public.notes (space_id, created_by, title, kind, preview_text, search_plain, search_text)
  select v_space, v_owner,
         'note ' || g,
         case g % 3 when 0 then 'list' else 'text' end,
         'filler words about trips and errands ' || g,
         'note ' || g || ' filler words about trips errands groceries ' || md5(g::text) || ' ' || md5((g * 7)::text),
         to_tsvector('english', 'note ' || g || ' filler words about trips errands groceries ' || md5(g::text) || ' ' || md5((g * 7)::text))
  from generate_series(1, 5000) g;
end
$$;
analyze public.notes;
