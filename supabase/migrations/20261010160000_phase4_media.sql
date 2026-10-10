-- Phase 4: media. Link previews carry what the link card needs; the bucket only takes media types.

alter table public.link_previews
  add column domain text,
  add column media_type text not null default 'article'
    check (media_type in ('article', 'video', 'maps')),
  add column lat double precision,
  add column lng double precision;

update storage.buckets
set allowed_mime_types = array[
  'image/webp', 'image/jpeg', 'image/png', 'image/gif',
  'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/aac'
]
where id = 'media';
