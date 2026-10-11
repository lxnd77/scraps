-- Phase 9.7: one small fixed-window limiter for the Edge Functions that had none (link unfurl,
-- account deletion, forever-delete, transcription retry). Service role only.
-- Window = `p_seconds`; the row resets once the window has passed.

create table public.rate_limits (
  key text primary key,
  window_start timestamptz not null,
  hits integer not null default 0
);
create index rate_limits_window_idx on public.rate_limits (window_start);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from public, anon, authenticated;

-- true while the caller is inside `p_limit` hits for the current window
create function public.rate_limit_hit(p_key text, p_limit integer, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  -- old windows are garbage; clearing a few per call keeps the table small without a job
  delete from public.rate_limits
  where key in (
    select r.key from public.rate_limits r
    where r.window_start < now() - interval '2 days'
    limit 20
  );

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set window_start = case
          when r.window_start < now() - make_interval(secs => p_seconds) then now()
          else r.window_start end,
        hits = case
          when r.window_start < now() - make_interval(secs => p_seconds) then 1
          else r.hits + 1 end
  returning hits into v_hits;
  return v_hits <= p_limit;
end;
$$;

revoke all on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
