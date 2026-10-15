-- The Oct 15 sticker set: 30 more stickers, drawn in the palette tokens (packages/ui Sticker.tsx).
-- profiles.avatar_sticker checks against the list, so it widens to match (packages/db STICKER_IDS).
alter table public.profiles drop constraint profiles_avatar_sticker_check;
alter table public.profiles add constraint profiles_avatar_sticker_check check (
  avatar_sticker in ('smiley', 'sleepy-moon', 'heart', 'sparkle', 'lightning', 'flower', 'speech-bubble', 'planet', 'zzz', 'sun', 'lol', 'side-eye', 'heart-eyes', 'cool', 'sleepy', 'skull', 'coffee', 'phone', 'headphones', 'laptop', 'plant', 'books', 'fire', 'star', 'rainbow', 'cloud', 'ghost', 'eyes', 'pizza', 'boba', 'cake', 'donut', 'avocado', 'strawberry', 'check', 'question', 'exclamation', 'sparkles', 'arrow', 'hundred')
);
