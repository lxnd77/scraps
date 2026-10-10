-- RLS policy tests (SPEC 11.3). Run with `pnpm db:test`.
-- Cast: alice owns s1, bob is an editor, cara a viewer, dan owns s2 and is not in s1.

begin;
select plan(48);

-- ---------------------------------------------------------------------------
-- fixtures (as postgres, bypassing RLS)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'alice@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'bob@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'cara@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'dan@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'eve@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'fay@t.test');

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 's1'),
  ('bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000004', 's2');

insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000002', 'editor'),
  ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003', 'viewer');

insert into public.notes (id, space_id, created_by, title) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 'in s1'),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000004', 'in s2');

insert into public.note_docs (note_id, ydoc) values
  ('cccccccc-0000-4000-8000-000000000001', '\x00');

insert into public.tags (id, space_id, name) values
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'travel'),
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000002', 'money');

insert into public.link_previews (url_hash, url, title) values ('h1', 'https://example.test', 'x');
insert into public.ai_suggestions (id, note_id, user_id, confidence) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001', 0.9);
insert into public.capture_tokens (user_id, token_hash) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'hash-alice');
insert into public.note_activity (user_id, day) values
  ('aaaaaaaa-0000-4000-8000-000000000001', current_date);
insert into storage.objects (bucket_id, name) values
  ('media', 'cccccccc-0000-4000-8000-000000000001/a1.webp');

-- ---------------------------------------------------------------------------
-- 1. the creator becomes owner automatically
-- ---------------------------------------------------------------------------
select is(
  (select role from public.space_members
   where space_id = 'bbbbbbbb-0000-4000-8000-000000000001'
     and user_id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  'owner',
  'space insert adds the creator as owner'
);

select is(
  (select count(*)::int from public.profiles
   where id in (select id from auth.users where email like '%@t.test')),
  6,
  'auth.users insert creates a profile for each user'
);

-- ---------------------------------------------------------------------------
-- 2. non-member (dan)
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000004","role":"authenticated"}', true); end $$;
set local role authenticated;

select is((select count(*)::int from public.spaces where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0, 'non-member cannot read the space');
select is((select count(*)::int from public.notes where space_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0, 'non-member cannot read its notes');
select is((select count(*)::int from public.space_members where space_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0, 'non-member cannot read its members');
select is((select count(*)::int from public.tags where space_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  0, 'non-member cannot read its tags');
select is((select count(*)::int from public.assets), 0, 'non-member sees no assets');
select is((select count(*)::int from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  0, 'strangers cannot read each others profiles');
select is((select count(*)::int from storage.objects where bucket_id = 'media'),
  0, 'non-member cannot read media objects');
select throws_ok(
  $$ insert into public.notes (space_id, created_by) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000004') $$,
  '42501', null, 'non-member cannot create a note in the space');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
     ('media', 'cccccccc-0000-4000-8000-000000000001/evil.webp') $$,
  '42501', null, 'non-member cannot upload media to the note');
select throws_ok(
  $$ insert into public.spaces (owner_id, name) values
     ('aaaaaaaa-0000-4000-8000-000000000001', 'spoofed') $$,
  '42501', null, 'a user cannot create a space owned by someone else');
select is((select public.space_role('bbbbbbbb-0000-4000-8000-000000000001')),
  null, 'space_role is null for a non-member');

-- ---------------------------------------------------------------------------
-- 3. viewer (cara)
-- ---------------------------------------------------------------------------
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000003","role":"authenticated"}', true); end $$;
set local role authenticated;

select is((select count(*)::int from public.notes where space_id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  1, 'viewer can read notes');
with u as (
  update public.notes set pinned = true where id = 'cccccccc-0000-4000-8000-000000000001' returning 1
)
select is(count(*)::int, 0, 'viewer cannot update notes') from u;
select throws_ok(
  $$ insert into public.notes (space_id, created_by) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003') $$,
  '42501', null, 'viewer cannot create notes');
select throws_ok(
  $$ insert into public.tags (space_id, name) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'nope') $$,
  '42501', null, 'viewer cannot create tags');
select throws_ok(
  $$ insert into public.assets (note_id, uploader_id, kind, storage_path, mime) values
     ('cccccccc-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000003',
      'image', 'x', 'image/webp') $$,
  '42501', null, 'viewer cannot add assets');
select is((select count(*)::int from storage.objects where bucket_id = 'media'),
  1, 'viewer can read media of the space');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values
     ('media', 'cccccccc-0000-4000-8000-000000000001/v.webp') $$,
  '42501', null, 'viewer cannot upload media');
select is((select count(*)::int from public.profiles where id = 'aaaaaaaa-0000-4000-8000-000000000001'),
  1, 'members can read each others profiles');
with u as (
  delete from public.space_members
  where space_id = 'bbbbbbbb-0000-4000-8000-000000000001'
    and user_id = 'aaaaaaaa-0000-4000-8000-000000000002' returning 1
)
select is(count(*)::int, 0, 'viewer cannot remove members') from u;
select throws_ok(
  $$ insert into public.space_members (space_id, user_id, role) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000005', 'viewer') $$,
  '42501', null, 'viewer cannot invite');

-- ---------------------------------------------------------------------------
-- 4. editor (bob)
-- ---------------------------------------------------------------------------
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000002","role":"authenticated"}', true); end $$;
set local role authenticated;

with u as (
  update public.notes set pinned = true where id = 'cccccccc-0000-4000-8000-000000000001' returning 1
)
select is(count(*)::int, 1, 'editor can update notes') from u;
select lives_ok(
  $$ insert into public.notes (id, space_id, created_by) values
     ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001',
      'aaaaaaaa-0000-4000-8000-000000000002') $$,
  'editor can create notes');
select throws_ok(
  $$ insert into public.notes (space_id, created_by) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001') $$,
  '42501', null, 'editor cannot create a note attributed to someone else');
select throws_ok(
  $$ update public.notes set space_id = 'bbbbbbbb-0000-4000-8000-000000000002'
     where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  '42501', null, 'moving a note needs editor rights in the target space too');
select lives_ok(
  $$ insert into public.tags (space_id, name) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'food') $$,
  'editor can create tags');
select lives_ok(
  $$ insert into public.note_tags (note_id, tag_id) values
     ('cccccccc-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001') $$,
  'editor can tag a note with a tag from the same space');
select throws_ok(
  $$ insert into public.note_tags (note_id, tag_id) values
     ('cccccccc-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000002') $$,
  '42501', null, 'a tag from another space cannot be attached');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name) values
     ('media', 'cccccccc-0000-4000-8000-000000000001/b1.webp') $$,
  'editor can upload media for a note in the space');
select throws_ok(
  $$ insert into storage.objects (bucket_id, name) values ('media', 'not-a-uuid/b1.webp') $$,
  '42501', null, 'media paths must start with a note id');
select lives_ok(
  $$ insert into public.assets (id, note_id, space_id, uploader_id, kind, storage_path, mime) values
     ('ffffffff-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
      'bbbbbbbb-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002',
      'audio', 'cccccccc-0000-4000-8000-000000000001/b1.webm', 'audio/webm') $$,
  'editor can add assets');
select is(
  (select space_id from public.assets where id = 'ffffffff-0000-4000-8000-000000000001'),
  'bbbbbbbb-0000-4000-8000-000000000001'::uuid,
  'asset space_id comes from the note, not the client');
select lives_ok(
  $$ insert into public.space_members (space_id, user_id, role) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000005', 'viewer') $$,
  'editor can invite viewers');
select throws_ok(
  $$ insert into public.space_members (space_id, user_id, role) values
     ('bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000006', 'editor') $$,
  '42501', null, 'editor cannot invite editors');
with u as (
  update public.spaces set name = 'renamed' where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning 1
)
select is(count(*)::int, 0, 'editor cannot rename the space') from u;
select is((select count(*)::int from public.note_docs), 0, 'note_docs is unreadable by authenticated');
select throws_ok(
  $$ insert into public.note_docs (note_id, ydoc) values
     ('cccccccc-0000-4000-8000-000000000003', '\x01') $$,
  '42501', null, 'note_docs is unwritable by authenticated');
select throws_ok(
  $$ insert into public.link_previews (url_hash, url) values ('h2', 'https://x.test') $$,
  '42501', null, 'link_previews is read-only for clients');
select is((select count(*)::int from public.ai_suggestions), 0, 'other users suggestions are private');
select is((select count(*)::int from public.capture_tokens), 0, 'other users capture tokens are private');
select is((select count(*)::int from public.note_activity), 0, 'other users activity is private');

-- ---------------------------------------------------------------------------
-- 5. owner (alice)
-- ---------------------------------------------------------------------------
reset role;
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}', true); end $$;
set local role authenticated;

with u as (
  update public.spaces set name = 'renamed' where id = 'bbbbbbbb-0000-4000-8000-000000000001' returning 1
)
select is(count(*)::int, 1, 'owner can rename the space') from u;
with u as (
  update public.space_members set role = 'editor'
  where space_id = 'bbbbbbbb-0000-4000-8000-000000000001'
    and user_id = 'aaaaaaaa-0000-4000-8000-000000000003' returning 1
)
select is(count(*)::int, 1, 'owner can change roles') from u;
select is((select count(*)::int from public.ai_suggestions), 1, 'owner sees their own suggestions');
select is((select count(*)::int from public.capture_tokens), 1, 'owner sees their own capture tokens');
select is((select count(*)::int from public.note_activity), 1, 'owner sees their own activity');

reset role;
select * from finish();
rollback;
