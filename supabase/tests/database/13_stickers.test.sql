-- The Oct 15 sticker set: the avatar constraint takes the new ids and still refuses junk.

begin;
select plan(3);

insert into auth.users (id, email) values ('aaaaaaaa-0000-4000-8000-000000000131', 'st@t.test');

select lives_ok(
  $$ update public.profiles set avatar_sticker = 'boba' where id = 'aaaaaaaa-0000-4000-8000-000000000131' $$,
  'a new sticker is a valid avatar');
select lives_ok(
  $$ update public.profiles set avatar_sticker = 'sleepy-moon' where id = 'aaaaaaaa-0000-4000-8000-000000000131' $$,
  'the original stickers still are');
select throws_ok(
  $$ update public.profiles set avatar_sticker = 'not-a-sticker' where id = 'aaaaaaaa-0000-4000-8000-000000000131' $$,
  '23514', null, 'anything else is refused');

select * from finish();
rollback;
