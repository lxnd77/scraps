-- Canvas board: who can place cards and stickers, last write wins on board_pos, and the batch
-- placement staying inside its space and under RLS.

begin;
select plan(15);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000121', 'canvas-owner@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000122', 'canvas-viewer@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000123', 'canvas-stranger@s.test');

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000121', 'aaaaaaaa-0000-4000-8000-000000000121', 'canvas'),
  ('bbbbbbbb-0000-4000-8000-000000000122', 'aaaaaaaa-0000-4000-8000-000000000123', 'elsewhere');
insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000121', 'aaaaaaaa-0000-4000-8000-000000000122', 'viewer')
on conflict do nothing;

insert into public.notes (id, space_id, created_by, kind, title) values
  ('cccccccc-0000-4000-8000-000000000121', 'bbbbbbbb-0000-4000-8000-000000000121',
   'aaaaaaaa-0000-4000-8000-000000000121', 'text', 'one'),
  ('cccccccc-0000-4000-8000-000000000122', 'bbbbbbbb-0000-4000-8000-000000000121',
   'aaaaaaaa-0000-4000-8000-000000000121', 'text', 'two'),
  ('cccccccc-0000-4000-8000-000000000123', 'bbbbbbbb-0000-4000-8000-000000000122',
   'aaaaaaaa-0000-4000-8000-000000000123', 'text', 'not yours');

select throws_ok(
  $$ update public.notes set board_pos = '{"x": 1.5, "y": 2}' where id = 'cccccccc-0000-4000-8000-000000000121' $$,
  '23514', null, 'board_pos must be whole grid cells');

-- the owner places a card, then an older write for the same field loses
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000121","role":"authenticated"}', true); end $$;
set local role authenticated;
update public.notes set board_pos = '{"x": 4, "y": 6}', meta_updated_at = now() + interval '1 minute'
  where id = 'cccccccc-0000-4000-8000-000000000121';
select is((select board_pos from public.notes where id = 'cccccccc-0000-4000-8000-000000000121'),
  '{"x": 4, "y": 6}'::jsonb, 'an editor can place a card');
update public.notes set board_pos = '{"x": 0, "y": 0}', meta_updated_at = now()
  where id = 'cccccccc-0000-4000-8000-000000000121';
select is((select board_pos from public.notes where id = 'cccccccc-0000-4000-8000-000000000121'),
  '{"x": 4, "y": 6}'::jsonb, 'an older move loses to a newer one');

-- batch placement: only cards in the named space, and only ones RLS lets you update
select is(public.set_board_positions('bbbbbbbb-0000-4000-8000-000000000121',
  '[{"id":"cccccccc-0000-4000-8000-000000000122","x":12,"y":0},
    {"id":"cccccccc-0000-4000-8000-000000000123","x":99,"y":99}]'::jsonb,
  now() + interval '2 minutes'), 1, 'the batch touches only cards in the space');
select is((select board_pos from public.notes where id = 'cccccccc-0000-4000-8000-000000000122'),
  '{"x": 12, "y": 0}'::jsonb, 'the batch places the card');

insert into public.board_stickers (id, space_id, sticker, x, y)
  values ('dddddddd-0000-4000-8000-000000000121', 'bbbbbbbb-0000-4000-8000-000000000121',
          'sparkle', 100, 200);
select is((select count(*)::int from public.board_stickers), 1, 'an editor can add a sticker');
update public.board_stickers set x = 300, rotation = 45 where id = 'dddddddd-0000-4000-8000-000000000121';
select is((select x from public.board_stickers where id = 'dddddddd-0000-4000-8000-000000000121'),
  300::real, 'an editor can move a sticker');
select throws_ok(
  $$ update public.board_stickers set scale = 9 where id = 'dddddddd-0000-4000-8000-000000000121' $$,
  '23514', null, 'sticker scale stays in range');
reset role;

-- a viewer sees the board but cannot change it
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000122","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.board_stickers), 1, 'a viewer sees the stickers');
update public.notes set board_pos = '{"x": 50, "y": 50}', meta_updated_at = now() + interval '1 hour'
  where id = 'cccccccc-0000-4000-8000-000000000121';
select is(public.set_board_positions('bbbbbbbb-0000-4000-8000-000000000121',
  '[{"id":"cccccccc-0000-4000-8000-000000000122","x":50,"y":50}]'::jsonb), 0,
  'a viewer cannot batch place');
update public.board_stickers set x = 0 where id = 'dddddddd-0000-4000-8000-000000000121';
delete from public.board_stickers;
select throws_ok(
  $$ insert into public.board_stickers (space_id, sticker) values ('bbbbbbbb-0000-4000-8000-000000000121', 'sparkle') $$,
  '42501', null, 'a viewer cannot add a sticker');
reset role;
select is((select board_pos from public.notes where id = 'cccccccc-0000-4000-8000-000000000121'),
  '{"x": 4, "y": 6}'::jsonb, 'a viewer cannot move a card');
select is((select x from public.board_stickers where id = 'dddddddd-0000-4000-8000-000000000121'),
  300::real, 'a viewer cannot move or delete a sticker');

-- a stranger sees nothing
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000123","role":"authenticated"}', true); end $$;
set local role authenticated;
select is((select count(*)::int from public.board_stickers), 0, 'a stranger sees no stickers');
delete from public.board_stickers;
reset role;
select is((select count(*)::int from public.board_stickers), 1, 'a stranger cannot delete them');

select * from finish();
rollback;
