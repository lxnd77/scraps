-- Phase 9: how much storage a person is using (shown in settings, soft limit in packages/db).
-- Counts the files they uploaded, wherever those scraps live now. Security invoker, so RLS on
-- assets still decides what is visible.

create function public.storage_usage() returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(sum(a.bytes), 0)::bigint
  from public.assets a
  where a.uploader_id = (select auth.uid());
$$;

revoke all on function public.storage_usage() from public, anon;
grant execute on function public.storage_usage() to authenticated;
