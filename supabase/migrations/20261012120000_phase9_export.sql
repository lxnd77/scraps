-- Phase 9: export. Zips are built by the collab server (service role) and handed back as a
-- signed link, so the bucket is private with no client policies at all.

insert into storage.buckets (id, name, public, file_size_limit)
values ('exports', 'exports', false, 52428800)
on conflict (id) do nothing;
