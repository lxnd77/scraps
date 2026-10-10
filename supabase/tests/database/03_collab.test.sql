-- Collab server functions: store_note, note_access, space_access, props last-write-wins.

begin;
select plan(14);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000021', 'ed@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000022', 'vi@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000023', 'out@t.test');

update public.profiles set timezone = 'Pacific/Auckland'
where id = 'aaaaaaaa-0000-4000-8000-000000000021';
update public.profiles set timezone = 'Not/AZone'
where id = 'aaaaaaaa-0000-4000-8000-000000000022';

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000021', 'sp');
insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000022', 'viewer');
insert into public.notes (id, space_id, created_by) values
  ('cccccccc-0000-4000-8000-000000000021', 'bbbbbbbb-0000-4000-8000-000000000021',
   'aaaaaaaa-0000-4000-8000-000000000021');

-- access
select is(public.note_access('cccccccc-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000021'),
  'owner', 'note_access returns the role');
select is(public.note_access('cccccccc-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000022'),
  'viewer', 'note_access returns viewer');
select is(public.note_access('cccccccc-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000023'),
  null, 'note_access is null for strangers');
select is(public.space_access('bbbbbbbb-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000022'),
  'viewer', 'space_access returns the role');

-- store
select lives_ok(
  $$ select public.store_note('cccccccc-0000-4000-8000-000000000021', '010203', 'the title',
       'preview words here', 'list', 7, '{"checklist":{"done":1,"total":2,"items":[]}}'::jsonb,
       'the title preview words here goa trip', 'aaaaaaaa-0000-4000-8000-000000000021') $$,
  'store_note runs');
select is((select ydoc from public.note_docs where note_id = 'cccccccc-0000-4000-8000-000000000021'),
  '\x010203'::bytea, 'the document is stored');
select is((select kind from public.notes where id = 'cccccccc-0000-4000-8000-000000000021'),
  'list', 'card fields are written');
select is((select preview #>> '{checklist,total}' from public.notes where id = 'cccccccc-0000-4000-8000-000000000021'),
  '2', 'preview json is written');
select ok(
  (select search_text @@ plainto_tsquery('english', 'goa') from public.notes where id = 'cccccccc-0000-4000-8000-000000000021'),
  'search_text is written and searchable');
select is((select last_edited_by from public.notes where id = 'cccccccc-0000-4000-8000-000000000021'),
  'aaaaaaaa-0000-4000-8000-000000000021'::uuid, 'last_edited_by is set');
select is((select count(*)::int from public.note_activity where user_id = 'aaaaaaaa-0000-4000-8000-000000000021'),
  1, 'a streak day is recorded');
select lives_ok(
  $$ select public.store_note('cccccccc-0000-4000-8000-000000000021', '04', 't', 'p', 'text', 1, '{}'::jsonb, 't',
       'aaaaaaaa-0000-4000-8000-000000000022') $$,
  'an unknown timezone name falls back to UTC instead of failing the store');

-- lock-down
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000021","role":"authenticated"}', true); end $$;
set local role authenticated;
select throws_ok(
  $$ select public.store_note('cccccccc-0000-4000-8000-000000000021', '00', 't', 'p', 'text', 0, '{}'::jsonb, 't', null) $$,
  '42501', null, 'users cannot call store_note');
select throws_ok(
  $$ select public.note_access('cccccccc-0000-4000-8000-000000000021', 'aaaaaaaa-0000-4000-8000-000000000021') $$,
  '42501', null, 'users cannot call note_access');

reset role;
select * from finish();
rollback;
