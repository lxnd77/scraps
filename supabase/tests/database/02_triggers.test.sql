-- Trigger and helper behaviour: metadata last-write-wins, transcripts, asset moves, counts.

begin;
select plan(14);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'alice2@t.test'),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'bob2@t.test');

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000011', 'a'),
  ('bbbbbbbb-0000-4000-8000-000000000012', 'aaaaaaaa-0000-4000-8000-000000000011', 'b');

insert into public.notes (id, space_id, created_by, pinned, color, meta_updated_at, title) values
  ('cccccccc-0000-4000-8000-000000000011', 'bbbbbbbb-0000-4000-8000-000000000011',
   'aaaaaaaa-0000-4000-8000-000000000011', false, 'yellow', '2026-01-02 00:00:00+00', 'one'),
  ('cccccccc-0000-4000-8000-000000000012', 'bbbbbbbb-0000-4000-8000-000000000011',
   'aaaaaaaa-0000-4000-8000-000000000011', false, 'yellow', now(), 'two');

-- ---------------------------------------------------------------------------
-- metadata last-write-wins, per field
-- ---------------------------------------------------------------------------
update public.notes set pinned = true, meta_updated_at = '2026-01-03 00:00:00+00'
where id = 'cccccccc-0000-4000-8000-000000000011';

-- a stale write: older than the pin above, touching pinned (stale) and color (never written)
update public.notes set pinned = false, color = 'pink', meta_updated_at = '2026-01-01 00:00:00+00'
where id = 'cccccccc-0000-4000-8000-000000000011';

select is(
  (select pinned from public.notes where id = 'cccccccc-0000-4000-8000-000000000011'),
  true, 'a stale write does not overwrite a field a newer write already set');
select is(
  (select color from public.notes where id = 'cccccccc-0000-4000-8000-000000000011'),
  'pink', 'but it still lands on fields nobody has written since');
select is(
  (select meta_updated_at from public.notes where id = 'cccccccc-0000-4000-8000-000000000011'),
  '2026-01-03 00:00:00+00'::timestamptz, 'a stale write never moves the row clock backwards');

update public.notes set pinned = false, meta_updated_at = '2026-01-04 00:00:00+00'
where id = 'cccccccc-0000-4000-8000-000000000011';
select is(
  (select pinned from public.notes where id = 'cccccccc-0000-4000-8000-000000000011'),
  false, 'a newer write wins');

-- out of order delivery: the later colour change (ts 6) arrives before the earlier pin (ts 5)
update public.notes set color = 'lime', meta_updated_at = '2026-01-06 00:00:00+00'
where id = 'cccccccc-0000-4000-8000-000000000011';
update public.notes set pinned = true, meta_updated_at = '2026-01-05 00:00:00+00'
where id = 'cccccccc-0000-4000-8000-000000000011';
select is(
  (select row(color, pinned)::text from public.notes where id = 'cccccccc-0000-4000-8000-000000000011'),
  '(lime,t)', 'writes to different fields both survive out of order delivery');

update public.notes set color = 'orange' where id = 'cccccccc-0000-4000-8000-000000000011';
select ok(
  (select meta_updated_at > '2026-01-06 00:00:00+00'::timestamptz
   from public.notes where id = 'cccccccc-0000-4000-8000-000000000011'),
  'a change that carries no new timestamp is stamped by the server');

update public.notes set title = 'one, edited', updated_at = now() + interval '1 minute'
where id = 'cccccccc-0000-4000-8000-000000000011';
select ok(
  (select meta_updated_at < now() + interval '30 seconds'
   from public.notes where id = 'cccccccc-0000-4000-8000-000000000011')
  and (select title from public.notes where id = 'cccccccc-0000-4000-8000-000000000011') = 'one, edited',
  'a content store (title, updated_at) does not touch the metadata clock');

-- ---------------------------------------------------------------------------
-- transcripts live in their own column
-- ---------------------------------------------------------------------------
update public.notes set search_text = to_tsvector('english', 'groceries and rent')
where id = 'cccccccc-0000-4000-8000-000000000012';

insert into public.assets (id, note_id, uploader_id, kind, storage_path, mime, transcript, transcript_status)
values ('ffffffff-0000-4000-8000-000000000011', 'cccccccc-0000-4000-8000-000000000012',
        'aaaaaaaa-0000-4000-8000-000000000011', 'audio',
        'cccccccc-0000-4000-8000-000000000012/m.webm', 'audio/webm',
        'book train tickets for the goa trip', 'done');

select ok(
  (select transcript_tsv @@ plainto_tsquery('english', 'goa')
   from public.notes where id = 'cccccccc-0000-4000-8000-000000000012'),
  'a transcript becomes searchable through transcript_tsv');

update public.notes set title = 'two, edited' where id = 'cccccccc-0000-4000-8000-000000000012';
select ok(
  (select transcript_tsv is not null and search_text @@ plainto_tsquery('english', 'groceries')
   from public.notes where id = 'cccccccc-0000-4000-8000-000000000012'),
  'search_text and transcript_tsv are independent: an extractor-style write keeps both');

update public.assets set transcript = null where id = 'ffffffff-0000-4000-8000-000000000011';
select is(
  (select transcript_tsv from public.notes where id = 'cccccccc-0000-4000-8000-000000000012'),
  null, 'removing the transcript clears transcript_tsv');

-- ---------------------------------------------------------------------------
-- moving a note moves its assets
-- ---------------------------------------------------------------------------
update public.notes set space_id = 'bbbbbbbb-0000-4000-8000-000000000012', meta_updated_at = now()
where id = 'cccccccc-0000-4000-8000-000000000012';
select is(
  (select space_id from public.assets where id = 'ffffffff-0000-4000-8000-000000000011'),
  'bbbbbbbb-0000-4000-8000-000000000012'::uuid, 'moving a note moves its assets to the new space');

-- ---------------------------------------------------------------------------
-- counts, deleted spaces, anonymous access
-- ---------------------------------------------------------------------------
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000011","role":"authenticated"}', true); end $$;
set local role authenticated;

select is(
  (select note_count from public.space_note_counts()
   where space_id = 'bbbbbbbb-0000-4000-8000-000000000011'),
  1::bigint, 'space_note_counts counts live notes per space');

reset role;
update public.spaces set deleted_at = now() where id = 'bbbbbbbb-0000-4000-8000-000000000012';
set local role authenticated;
select is(
  (select public.space_role('bbbbbbbb-0000-4000-8000-000000000012')),
  null, 'a soft-deleted space grants no role');

reset role;
set local role anon;
select throws_ok($$ select * from public.spaces $$, '42501', null,
  'anonymous visitors have no table access');

reset role;
select * from finish();
rollback;
