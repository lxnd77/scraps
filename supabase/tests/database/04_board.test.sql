-- Phase 3: filter counts, search and streak.

begin;
select plan(10);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000031', 'me@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000032', 'other@t.test');

update public.profiles set timezone = 'Pacific/Auckland'
where id = 'aaaaaaaa-0000-4000-8000-000000000031';

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000031', 'aaaaaaaa-0000-4000-8000-000000000031', 'mine'),
  ('bbbbbbbb-0000-4000-8000-000000000032', 'aaaaaaaa-0000-4000-8000-000000000032', 'theirs');

insert into public.notes (id, space_id, created_by, title, kind, search_plain, search_text) values
  ('cccccccc-0000-4000-8000-000000000031', 'bbbbbbbb-0000-4000-8000-000000000031',
   'aaaaaaaa-0000-4000-8000-000000000031', 'packing', 'list', 'packing sunscreen charger passport',
   to_tsvector('english', 'packing sunscreen charger passport')
     || to_tsvector('simple', 'packing sunscreen charger passport')),
  ('cccccccc-0000-4000-8000-000000000032', 'bbbbbbbb-0000-4000-8000-000000000031',
   'aaaaaaaa-0000-4000-8000-000000000031', 'random thought', 'text', 'random thought about sunscreen',
   to_tsvector('english', 'random thought about sunscreen')
     || to_tsvector('simple', 'random thought about sunscreen')),
  ('cccccccc-0000-4000-8000-000000000033', 'bbbbbbbb-0000-4000-8000-000000000032',
   'aaaaaaaa-0000-4000-8000-000000000032', 'secret sunscreen plan', 'text', 'secret sunscreen plan',
   to_tsvector('english', 'secret sunscreen plan') || to_tsvector('simple', 'secret sunscreen plan'));

-- streak: three days ending yesterday (Auckland), plus an older isolated day
insert into public.note_activity (user_id, day)
select 'aaaaaaaa-0000-4000-8000-000000000031',
       ((now() at time zone 'Pacific/Auckland')::date - d)
from unnest(array[1, 2, 3, 6]) as d;

do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000031","role":"authenticated"}', true); end $$;
set local role authenticated;

select is((select streak from public.current_streak()), 3,
  'a run ending yesterday is still alive and ignores the older gap');
select is((select active_today from public.current_streak()), false,
  'not active today yet');

select is((select note_count from public.space_kind_counts('bbbbbbbb-0000-4000-8000-000000000031')
  where kind = 'list'), 1::bigint, 'counts group by kind');
select is((select count(*)::int from public.space_kind_counts('bbbbbbbb-0000-4000-8000-000000000032')),
  0, 'counts for a space you are not in are empty');

select is((select count(*)::int from public.search_notes('sunscreen')), 2,
  'search finds my notes and not a stranger''s');
select is((select id from public.search_notes('passport')), 'cccccccc-0000-4000-8000-000000000031'::uuid,
  'search finds a word inside the body');
select ok((select snippet from public.search_notes('passport')) like '%<<passport>>%',
  'the snippet marks the match');
select is((select count(*)::int from public.search_notes('packin')), 1,
  'title trigram matching catches a partial word');
select is((select count(*)::int from public.search_notes('   ')), 0, 'blank query returns nothing');

reset role;
-- today counts once there is activity today
insert into public.note_activity (user_id, day)
values ('aaaaaaaa-0000-4000-8000-000000000031', (now() at time zone 'Pacific/Auckland')::date);
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000031","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select streak from public.current_streak()), 4, 'activity today extends the streak');

reset role;
select * from finish();
rollback;
