-- Local development seed. Grows with each phase so demos look like the design reference.
-- Two demo users sign in with magic links (read the mail in Mailpit, http://127.0.0.1:54324):
--   dev@scraps.test   owns the five design spaces
--   maya@scraps.test  is an editor in "side quests" and a viewer in "moodboards"

insert into auth.users (
  id, instance_id, aud, role, email, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
) values
  ('00000000-0000-4000-8000-0000000000d1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dev@scraps.test', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(),
   '', '', '', '', '', '', '', ''),
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'maya@scraps.test', now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(),
   '', '', '', '', '', '', '', '');

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
) values
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000d1',
   '00000000-0000-4000-8000-0000000000d1', 'email',
   '{"sub":"00000000-0000-4000-8000-0000000000d1","email":"dev@scraps.test","email_verified":true}',
   now(), now(), now()),
  (gen_random_uuid(), '00000000-0000-4000-8000-0000000000a1',
   '00000000-0000-4000-8000-0000000000a1', 'email',
   '{"sub":"00000000-0000-4000-8000-0000000000a1","email":"maya@scraps.test","email_verified":true}',
   now(), now(), now());

-- profiles were created by the auth.users trigger; finish them as if onboarding was done
update public.profiles set
  display_name = 'dev', avatar_sticker = 'sleepy-moon', birth_year = 2002,
  timezone = 'Asia/Kolkata', onboarded_at = now()
where id = '00000000-0000-4000-8000-0000000000d1';

update public.profiles set
  display_name = 'maya', avatar_sticker = 'flower', birth_year = 2001,
  timezone = 'Asia/Kolkata', onboarded_at = now()
where id = '00000000-0000-4000-8000-0000000000a1';

-- the five spaces from the design (owner membership is added by trigger)
insert into public.spaces (id, owner_id, name, color) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-0000000000d1', 'brain dump', 'yellow'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-0000000000d1', 'uni stuff', 'blue'),
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000d1', 'side quests', 'lime'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000d1', 'moodboards', 'pink'),
  ('10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-0000000000d1', 'recipes i''ll never make', 'orange');

update public.profiles
set default_capture_space = '10000000-0000-4000-8000-000000000001'
where id = '00000000-0000-4000-8000-0000000000d1';

-- maya has her own brain dump and joins two of dev's spaces
insert into public.spaces (id, owner_id, name, color) values
  ('10000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-0000000000a1', 'brain dump', 'yellow');

update public.profiles
set default_capture_space = '10000000-0000-4000-8000-000000000011'
where id = '00000000-0000-4000-8000-0000000000a1';

insert into public.space_members (space_id, user_id, role) values
  ('10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-0000000000a1', 'editor'),
  ('10000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-0000000000a1', 'viewer');
