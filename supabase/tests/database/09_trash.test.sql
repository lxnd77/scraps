-- Phase 9: trash. The purge itself runs in the Edge Function; here: who can see and restore
-- trashed notes, and that the scheduler hook is not reachable from clients.

begin;
select plan(8);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000091', 'trash-owner@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000092', 'trash-viewer@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000093', 'trash-stranger@s.test');

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000091', 'aaaaaaaa-0000-4000-8000-000000000091', 'trashy');
insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000091', 'aaaaaaaa-0000-4000-8000-000000000092', 'viewer')
on conflict do nothing;

insert into public.notes (id, space_id, created_by, kind, title, deleted_at) values
  ('cccccccc-0000-4000-8000-000000000091', 'bbbbbbbb-0000-4000-8000-000000000091',
   'aaaaaaaa-0000-4000-8000-000000000091', 'text', 'in the bin', now() - interval '3 days');

select ok(exists (select 1 from pg_indexes where indexname = 'notes_deleted_at_idx'),
  'trashed notes are indexed for the purge');

-- the owner sees trashed notes and can restore one
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000091","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.notes where deleted_at is not null), 1,
  'the owner sees the trashed scrap');
delete from public.notes;
select is((select count(*)::int from public.notes where deleted_at is not null), 1,
  'clients cannot hard delete notes (no delete policy)');
select throws_ok($$ select public.purge_trash_hook() $$, '42501', null,
  'clients cannot trigger the purge hook');
reset role;

-- a viewer sees it but cannot restore it
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000092","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.notes where deleted_at is not null), 1,
  'a viewer can see the trash');
update public.notes set deleted_at = null where id = 'cccccccc-0000-4000-8000-000000000091';
reset role;
select isnt((select deleted_at from public.notes where id = 'cccccccc-0000-4000-8000-000000000091'),
  null, 'a viewer cannot restore');

-- a stranger sees nothing
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000093","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.notes where deleted_at is not null), 0,
  'a stranger sees no trash');
reset role;

-- the owner restores
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000091","role":"authenticated"}', true); end $$;
set local role authenticated;
update public.notes set deleted_at = null where id = 'cccccccc-0000-4000-8000-000000000091';
reset role;
select is((select deleted_at from public.notes where id = 'cccccccc-0000-4000-8000-000000000091'),
  null, 'the owner can restore');

select * from finish();
rollback;
