-- Phase 9.7: the shared limiter. Service role only; windows reset; keys are independent.

begin;
select plan(6);

do $$ begin perform set_config('request.jwt.claims', '{"role":"authenticated"}', true); end $$;
set local role authenticated;
select throws_ok($$ select public.rate_limit_hit('k', 1, 60) $$, '42501', null,
  'clients cannot call the limiter');
select throws_ok($$ select * from public.rate_limits $$, '42501', null,
  'clients cannot read the table');
reset role;

do $$ begin perform set_config('request.jwt.claims', '{"role":"service_role"}', true); end $$;
set local role service_role;
select is((select count(*)::int from generate_series(1, 3) g
  where public.rate_limit_hit('a', 3, 60)), 3, 'three hits fit in a limit of three');
select is(public.rate_limit_hit('a', 3, 60), false, 'the fourth is refused');
select is(public.rate_limit_hit('b', 3, 60), true, 'another key has its own window');
reset role;

-- once the window has passed the counter starts again
update public.rate_limits set window_start = now() - interval '2 minutes' where key = 'a';
set local role service_role;
select is(public.rate_limit_hit('a', 3, 60), true, 'the window resets');
reset role;

select * from finish();
rollback;
