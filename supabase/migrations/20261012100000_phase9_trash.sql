-- Phase 9: trash. Soft delete already exists (notes.deleted_at); this adds what the 30 day purge
-- needs: an index over deleted rows and a daily call to the `purge-trash` Edge Function.
-- The function removes storage objects first (the storage API is the only way to delete the
-- files) and then the note rows; assets, tag links, documents and suggestions go by cascade.

create index notes_deleted_at_idx on public.notes (deleted_at) where deleted_at is not null;

-- Same pattern as assets_transcribe_hook: url and secret come from app_config (service role only).
create function public.purge_trash_hook() returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
  v_key text;
begin
  select value into v_url from public.app_config where key = 'functions_url';
  select value into v_secret from public.app_config where key = 'internal_secret';
  select value into v_key from public.app_config where key = 'functions_apikey';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url || '/purge-trash',
    body := jsonb_build_object('purge', true),
    headers := jsonb_strip_nulls(jsonb_build_object(
      'content-type', 'application/json',
      'x-internal-secret', v_secret,
      'apikey', v_key
    ))
  );
end;
$$;

revoke all on function public.purge_trash_hook() from public, anon, authenticated;
grant execute on function public.purge_trash_hook() to service_role;

-- Daily at 03:10 UTC when pg_cron is available (it is on Supabase). Elsewhere, call the function
-- from any scheduler: POST /functions/v1/purge-trash with x-internal-secret and {"purge": true}.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('scraps-purge-trash', '10 3 * * *', 'select public.purge_trash_hook()');
  end if;
exception when others then
  raise notice 'pg_cron not scheduled: %', sqlerrm;
end;
$$;
