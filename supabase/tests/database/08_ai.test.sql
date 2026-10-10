-- Phase 8: transcript guard, preview excerpt, AI rate limit, realtime, opt-in flag.

begin;
select plan(16);

insert into auth.users (id, email) values
  ('aaaaaaaa-0000-4000-8000-000000000081', 'ai-owner@s.test'),
  ('aaaaaaaa-0000-4000-8000-000000000082', 'ai-viewer@s.test');

insert into public.spaces (id, owner_id, name) values
  ('bbbbbbbb-0000-4000-8000-000000000081', 'aaaaaaaa-0000-4000-8000-000000000081', 'brain dump');
insert into public.space_members (space_id, user_id, role) values
  ('bbbbbbbb-0000-4000-8000-000000000081', 'aaaaaaaa-0000-4000-8000-000000000082', 'viewer')
on conflict do nothing;

insert into public.notes (id, space_id, created_by, kind, title) values
  ('cccccccc-0000-4000-8000-000000000081', 'bbbbbbbb-0000-4000-8000-000000000081',
   'aaaaaaaa-0000-4000-8000-000000000081', 'voice', 'memo');

-- as the owner: insert an audio asset, whatever status the client claims
do $$ begin perform set_config('request.jwt.claims',
  '{"sub":"aaaaaaaa-0000-4000-8000-000000000081","role":"authenticated"}', true); end $$;
set local role authenticated;

insert into public.assets (id, note_id, uploader_id, kind, storage_path, mime, transcript, transcript_status)
values ('dddddddd-0000-4000-8000-000000000081', 'cccccccc-0000-4000-8000-000000000081',
        'aaaaaaaa-0000-4000-8000-000000000081', 'audio',
        'cccccccc-0000-4000-8000-000000000081/dddddddd-0000-4000-8000-000000000081.webm',
        'audio/webm', 'planted', 'done');
select is((select transcript_status from public.assets
  where id = 'dddddddd-0000-4000-8000-000000000081'), 'pending',
  'a new audio asset is pending whatever the client sent');
select is((select transcript from public.assets
  where id = 'dddddddd-0000-4000-8000-000000000081'), null,
  'a client cannot plant a transcript on insert');

insert into public.assets (id, note_id, uploader_id, kind, storage_path, mime)
values ('dddddddd-0000-4000-8000-000000000082', 'cccccccc-0000-4000-8000-000000000081',
        'aaaaaaaa-0000-4000-8000-000000000081', 'image',
        'cccccccc-0000-4000-8000-000000000081/dddddddd-0000-4000-8000-000000000082.webp',
        'image/webp');
select is((select transcript_status from public.assets
  where id = 'dddddddd-0000-4000-8000-000000000082'), 'none',
  'an image asset has no transcript status');

select throws_ok($$ update public.assets set transcript = 'mine'
  where id = 'dddddddd-0000-4000-8000-000000000081' $$, '42501', null,
  'a client cannot write a transcript');
select throws_ok($$ update public.assets set transcript_status = 'done'
  where id = 'dddddddd-0000-4000-8000-000000000081' $$, '42501', null,
  'a client cannot set the transcript status');
select lives_ok($$ update public.assets set duration_ms = 4000
  where id = 'dddddddd-0000-4000-8000-000000000081' $$,
  'other columns stay writable');

-- the rate limiter and config are not reachable from clients
select throws_ok($$ select public.use_ai_slot('aaaaaaaa-0000-4000-8000-000000000081') $$,
  '42501', null, 'clients cannot call use_ai_slot');
select throws_ok($$ select * from public.ai_rate $$, '42501', null,
  'clients cannot read the rate table');
select throws_ok($$ select * from public.app_config $$, '42501', null,
  'clients cannot read the app config');
reset role;

-- the service role writes the transcript; the search vector and the card excerpt follow
update public.notes
set preview = jsonb_build_object('voice',
  jsonb_build_object('assetId', 'dddddddd-0000-4000-8000-000000000081'))
where id = 'cccccccc-0000-4000-8000-000000000081';

do $$ begin perform set_config('request.jwt.claims', '{"role":"service_role"}', true); end $$;
set local role service_role;
update public.assets
set transcript = 'remember to book the train tickets for goa', transcript_status = 'done'
where id = 'dddddddd-0000-4000-8000-000000000081';
reset role;

select is((select preview #>> '{voice,excerpt}' from public.notes
  where id = 'cccccccc-0000-4000-8000-000000000081'),
  'remember to book the train tickets for goa', 'the card excerpt follows the transcript');
select ok((select transcript_tsv @@ websearch_to_tsquery('english', 'goa')
  from public.notes where id = 'cccccccc-0000-4000-8000-000000000081'),
  'the transcript is searchable');

-- a later content store rewrites the preview but keeps the excerpt
select public.store_note(
  'cccccccc-0000-4000-8000-000000000081', '00', 'memo', '', 'voice', 0,
  jsonb_build_object('voice', jsonb_build_object('assetId', 'dddddddd-0000-4000-8000-000000000081')),
  '', null);
select is((select preview #>> '{voice,excerpt}' from public.notes
  where id = 'cccccccc-0000-4000-8000-000000000081'),
  'remember to book the train tickets for goa', 'the excerpt survives a store');

-- rate limit: 60 calls an hour
set local role service_role;
select is((select count(*)::int from generate_series(1, 60) g
  where public.use_ai_slot('aaaaaaaa-0000-4000-8000-000000000081')), 60,
  'sixty calls are allowed');
select is(public.use_ai_slot('aaaaaaaa-0000-4000-8000-000000000081'), false,
  'the sixty-first is refused');
reset role;

-- opt-in flag exists and defaults to unanswered
select is((select ai_prompted_at from public.profiles
  where id = 'aaaaaaaa-0000-4000-8000-000000000081'), null,
  'the opt-in prompt starts unanswered');

select ok(exists (select 1 from pg_publication_tables
  where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'assets'),
  'assets are published to realtime');

select * from finish();
rollback;
