-- Phase 7: capture tokens, token lookup and the rate limit.

begin;
select plan(15);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000071', 'cap-owner@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000072', 'cap-other@s.test');

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000071', 'aaaaaaaa-0000-4000-8000-000000000071', 'first'),
  ('bbbbbbbb-0000-4000-8000-000000000072', 'aaaaaaaa-0000-4000-8000-000000000071', 'second');
update public.profiles
set default_capture_space = 'bbbbbbbb-0000-4000-8000-000000000072'
where id = 'aaaaaaaa-0000-4000-8000-000000000071';

create temp table tokens (name text primary key, token text);
grant all on tokens to authenticated, service_role;

-- as the owner
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000071","role":"authenticated"}', true); end $$;
set local role authenticated;

insert into tokens select 'one', public.create_capture_token('my iphone');
select matches((select token from tokens where name = 'one'), '^scr_[0-9a-f]{64}$',
  'a token is scr_ plus 32 random bytes');
select is((select count(*)::int from public.capture_tokens where label = 'my iphone'), 1,
  'the owner sees their token row');
select is((select count(*)::int from public.capture_tokens
  where token_hash = (select token from tokens where name = 'one')), 0,
  'the plaintext is never stored');
select throws_ok($$ select * from public.capture_rate $$, '42501', null,
  'clients cannot read the rate table');
select throws_ok($$ select * from public.use_capture_token('abc') $$, '42501', null,
  'clients cannot resolve tokens');

-- another person sees nothing and cannot revoke
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000072","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.capture_tokens), 0, 'a stranger sees no tokens');
update public.capture_tokens set revoked_at = now();
reset role;
select is((select count(*)::int from public.capture_tokens where revoked_at is not null), 0,
  'a stranger cannot revoke someone else''s token');

-- the service role resolves a token by hash
set local role service_role;
select is((select status from public.use_capture_token(
  encode(extensions.digest((select token from tokens where name = 'one'), 'sha256'), 'hex'))),
  'ok', 'a live token resolves');
select is((select space_id from public.use_capture_token(
  encode(extensions.digest((select token from tokens where name = 'one'), 'sha256'), 'hex'))),
  'bbbbbbbb-0000-4000-8000-000000000072'::uuid, 'the default capture space is used');
select is((select status from public.use_capture_token('nonsense')), 'invalid',
  'an unknown token is invalid');
reset role;
select isnt((select last_used_at from public.capture_tokens where label = 'my iphone'), null,
  'use stamps last_used_at');

-- the default space falls back to the oldest own space when the default is gone
update public.spaces set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000072';
set local role service_role;
select is((select space_id from public.use_capture_token(
  encode(extensions.digest((select token from tokens where name = 'one'), 'sha256'), 'hex'))),
  'bbbbbbbb-0000-4000-8000-000000000071'::uuid, 'a deleted default falls back');

-- rate limit: 30 per minute (3 calls so far)
do $$
declare i int;
begin
  for i in 1..27 loop
    perform * from public.use_capture_token(
      encode(extensions.digest((select token from tokens where name = 'one'), 'sha256'), 'hex'));
  end loop;
end $$;
select is((select status from public.use_capture_token(
  encode(extensions.digest((select token from tokens where name = 'one'), 'sha256'), 'hex'))),
  'rate_limited', 'the 31st call in a minute is limited');
reset role;
update public.capture_rate set window_start = now() - interval '2 minutes';
set local role service_role;
select is((select status from public.use_capture_token(
  encode(extensions.digest((select token from tokens where name = 'one'), 'sha256'), 'hex'))),
  'ok', 'a new minute starts a new window');

-- revoked tokens are invalid
reset role;
update public.capture_tokens set revoked_at = now() where label = 'my iphone';
set local role service_role;
select is((select status from public.use_capture_token(
  encode(extensions.digest((select token from tokens where name = 'one'), 'sha256'), 'hex'))),
  'invalid', 'a revoked token is invalid');

reset role;
select * from finish();
rollback;
