-- Phase 9: account deletion support. The choices are applied by the delete-account Edge Function
-- (service role); here: the transfer function's rules and that clients cannot call it.

begin;
select plan(8);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-0000000000a1', 'acct-owner@s.test'),
  ('aaaaaaaa-0000-4000-8000-0000000000a2', 'acct-editor@s.test'),
  ('aaaaaaaa-0000-4000-8000-0000000000a3', 'acct-viewer@s.test');

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a1', 'handover');
insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a2', 'editor'),
  ('bbbbbbbb-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-0000000000a3', 'viewer')
on conflict do nothing;

-- clients cannot call it
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-0000000000a1","role":"authenticated"}', true); end $$;
set local role authenticated;
select throws_ok($$ select public.account_transfer_space(
  'aaaaaaaa-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a1',
  'aaaaaaaa-0000-4000-8000-0000000000a2') $$, '42501', null,
  'clients cannot transfer spaces directly');
reset role;

do $$ begin perform set_config('request.jwt.claims', '{"role":"service_role"}', true); end $$;
set local role service_role;

select throws_ok($$ select public.account_transfer_space(
  'aaaaaaaa-0000-4000-8000-0000000000a2', 'bbbbbbbb-0000-4000-8000-0000000000a1',
  'aaaaaaaa-0000-4000-8000-0000000000a2') $$, '42501', null,
  'only the owner can hand a space over');
select throws_ok($$ select public.account_transfer_space(
  'aaaaaaaa-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a1',
  'aaaaaaaa-0000-4000-8000-0000000000a3') $$, '22023', null,
  'a viewer cannot receive a space');
select throws_ok($$ select public.account_transfer_space(
  'aaaaaaaa-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a1',
  'aaaaaaaa-0000-4000-8000-0000000000a1') $$, '22023', null,
  'a space cannot be handed to its own owner');

select lives_ok($$ select public.account_transfer_space(
  'aaaaaaaa-0000-4000-8000-0000000000a1', 'bbbbbbbb-0000-4000-8000-0000000000a1',
  'aaaaaaaa-0000-4000-8000-0000000000a2') $$, 'an editor can receive it');
reset role;

select is((select owner_id from public.spaces where id = 'bbbbbbbb-0000-4000-8000-0000000000a1'),
  'aaaaaaaa-0000-4000-8000-0000000000a2'::uuid, 'the space has a new owner');
select is((select role from public.space_members
  where space_id = 'bbbbbbbb-0000-4000-8000-0000000000a1'
    and user_id = 'aaaaaaaa-0000-4000-8000-0000000000a2'), 'owner', 'the new owner is a member owner');
select is((select role from public.space_members
  where space_id = 'bbbbbbbb-0000-4000-8000-0000000000a1'
    and user_id = 'aaaaaaaa-0000-4000-8000-0000000000a1'), 'editor',
  'the old owner steps down, so deleting their profile keeps the space');

select * from finish();
rollback;
