-- Phase 5: invites, membership policies and member listing.

begin;
select plan(18);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000051', 'owner@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000052', 'editor@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000053', 'viewer@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000054', 'newbie@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000055', 'other@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000056', 'late@s.test');
update public.profiles set display_name = 'olive' where id = 'aaaaaaaa-0000-4000-8000-000000000051';

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000051', 'aaaaaaaa-0000-4000-8000-000000000051', 'shared');
insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000051', 'aaaaaaaa-0000-4000-8000-000000000052', 'editor'),
  ('bbbbbbbb-0000-4000-8000-000000000051', 'aaaaaaaa-0000-4000-8000-000000000053', 'viewer');

create temp table tokens (name text primary key, token text);
grant all on tokens to authenticated;

-- as the owner
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000051","role":"authenticated"}', true); end $$;
set local role authenticated;

insert into tokens select 'editor_invite',
  public.create_invite('bbbbbbbb-0000-4000-8000-000000000051', 'editor', 7, 20);
select is((select length(token) from tokens where name = 'editor_invite'), 64,
  'the owner gets a 32 byte token');
select is((select count(*)::int from public.space_invites
  where token_hash = (select token from tokens where name = 'editor_invite')),
  0, 'the token itself is never stored');
select is((select count(*)::int from public.list_space_members('bbbbbbbb-0000-4000-8000-000000000051')),
  3, 'members of the space are listed');

-- as the editor
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000052","role":"authenticated"}', true); end $$;
set local role authenticated;
select throws_ok($$ select public.create_invite('bbbbbbbb-0000-4000-8000-000000000051', 'editor') $$,
  '42501', null, 'an editor cannot invite editors');
select lives_ok($$ insert into tokens select 'viewer_invite',
  public.create_invite('bbbbbbbb-0000-4000-8000-000000000051', 'viewer', 7, 1) $$,
  'an editor can invite viewers');

-- as a viewer
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000053","role":"authenticated"}', true); end $$;
set local role authenticated;
select throws_ok($$ select public.create_invite('bbbbbbbb-0000-4000-8000-000000000051', 'viewer') $$,
  '42501', null, 'a viewer cannot invite');
select is((select count(*)::int from public.space_invites), 0, 'a viewer cannot see invites');

-- a stranger cannot mint one either
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000055","role":"authenticated"}', true); end $$;
set local role authenticated;
select throws_ok($$ select public.create_invite('bbbbbbbb-0000-4000-8000-000000000051', 'viewer') $$,
  '42501', null, 'a non-member cannot invite');

-- the newbie previews and joins with the editor invite
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000054","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select space_name from public.invite_preview((select token from tokens where name = 'editor_invite'))),
  'shared', 'preview shows the space');
select is((select inviter_name from public.invite_preview((select token from tokens where name = 'editor_invite'))),
  'olive', 'preview shows who invited');
select is((select count(*)::int from public.invite_preview('nonsense')), 0, 'a bad token previews nothing');
select is(public.accept_invite((select token from tokens where name = 'editor_invite')),
  'bbbbbbbb-0000-4000-8000-000000000051'::uuid, 'accepting returns the space');
select is(public.space_role('bbbbbbbb-0000-4000-8000-000000000051'), 'editor', 'the invite role is applied');
select is(public.accept_invite('nonsense'), null, 'a bad token returns null');

-- max uses: the viewer invite has one use; the first taker wins and the second is refused
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000055","role":"authenticated"}', true); end $$;
set local role authenticated;
select isnt(public.accept_invite((select token from tokens where name = 'viewer_invite')), null,
  'the single use is taken');
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000056","role":"authenticated"}', true); end $$;
set local role authenticated;
select is(public.accept_invite((select token from tokens where name = 'viewer_invite')), null,
  'a used-up invite is refused');

-- expiry
reset role;
update public.space_invites set expires_at = now() - interval '1 minute' where role = 'editor';
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000056","role":"authenticated"}', true); end $$;
set local role authenticated;
select is(public.accept_invite((select token from tokens where name = 'editor_invite')), null,
  'an expired invite is refused');

-- the owner cannot leave through the members policy
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000051","role":"authenticated"}', true); end $$;
set local role authenticated;
delete from public.space_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000051';
select is((select count(*)::int from public.space_members
  where user_id = 'aaaaaaaa-0000-4000-8000-000000000051'),
  1, 'the owner cannot remove themselves');

reset role;
select * from finish();
rollback;
