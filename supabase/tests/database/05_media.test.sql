-- Phase 4: assets and link previews.

begin;
select plan(7);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000041', 'ed@m.test'),
  ('aaaaaaaa-0000-4000-8000-000000000042', 'vi@m.test'),
  ('aaaaaaaa-0000-4000-8000-000000000043', 'out@m.test');
insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000041', 'aaaaaaaa-0000-4000-8000-000000000041', 'sp'),
  ('bbbbbbbb-0000-4000-8000-000000000042', 'aaaaaaaa-0000-4000-8000-000000000043', 'other');
insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000041', 'aaaaaaaa-0000-4000-8000-000000000042', 'viewer');
insert into public.notes (id, space_id, created_by) values
  ('cccccccc-0000-4000-8000-000000000041', 'bbbbbbbb-0000-4000-8000-000000000041',
   'aaaaaaaa-0000-4000-8000-000000000041'),
  ('cccccccc-0000-4000-8000-000000000042', 'bbbbbbbb-0000-4000-8000-000000000042',
   'aaaaaaaa-0000-4000-8000-000000000043');
insert into public.link_previews (url_hash, url, title, domain, media_type)
values ('h1', 'https://example.com/a', 'a', 'example.com', 'video');

-- editor
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000041","role":"authenticated"}', true); end $$;
set local role authenticated;
select lives_ok($$ insert into public.assets (id, note_id, uploader_id, kind, storage_path, mime, bytes)
  values ('dddddddd-0000-4000-8000-000000000041', 'cccccccc-0000-4000-8000-000000000041',
  'aaaaaaaa-0000-4000-8000-000000000041', 'image', 'cccccccc-0000-4000-8000-000000000041/x.webp',
  'image/webp', 1000) $$, 'an editor can add an image asset');
select is((select space_id from public.assets where id = 'dddddddd-0000-4000-8000-000000000041'),
  'bbbbbbbb-0000-4000-8000-000000000041'::uuid, 'space_id comes from the note');
select throws_ok($$ insert into public.assets (note_id, uploader_id, kind, storage_path, mime)
  values ('cccccccc-0000-4000-8000-000000000042', 'aaaaaaaa-0000-4000-8000-000000000041',
  'audio', 'x/y.webm', 'audio/webm') $$, '42501', null, 'cannot add an asset to a note in another space');
select throws_ok($$ insert into public.link_previews (url_hash, url) values ('h2', 'https://x.test') $$,
  '42501', null, 'users cannot write link previews');
select is((select count(*)::int from public.link_previews), 1, 'users can read link previews');

-- viewer
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000042","role":"authenticated"}', true); end $$;
set local role authenticated;
select throws_ok($$ insert into public.assets (note_id, uploader_id, kind, storage_path, mime)
  values ('cccccccc-0000-4000-8000-000000000041', 'aaaaaaaa-0000-4000-8000-000000000042',
  'image', 'x/y.webp', 'image/webp') $$, '42501', null, 'a viewer cannot add assets');
select is((select count(*)::int from public.assets), 1, 'a viewer can see the space assets');

reset role;
select * from finish();
rollback;
