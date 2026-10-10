-- Phase 7: capture tokens for the iOS shortcut.
-- Tokens are minted by a security definer function so the plaintext is returned once and the
-- client never writes `token_hash`. The `capture` Edge Function (service role) resolves a token
-- through `use_capture_token`, which also applies the 30 per minute limit.

create table public.capture_rate (
  token_id uuid primary key references public.capture_tokens (id) on delete cascade,
  window_start timestamptz not null,
  hits integer not null default 0
);

-- service role only: RLS on, no policies, no client privileges
alter table public.capture_rate enable row level security;
revoke all on public.capture_rate from public, anon, authenticated;

-- Returns the token, `scr_` plus 64 hex characters. Only its SHA-256 is stored.
create function public.create_capture_token(p_label text default '') returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_label text := left(btrim(coalesce(p_label, '')), 40);
  v_token text;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if (select count(*) from public.capture_tokens
      where user_id = v_user and revoked_at is null) >= 10 then
    raise exception 'too many tokens' using errcode = '54000';
  end if;

  v_token := 'scr_' || encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.capture_tokens (user_id, token_hash, label)
  values (v_user, public.hash_invite_token(v_token), v_label);
  return v_token;
end;
$$;

-- Looks a token up by its hash. status is 'ok', 'invalid' (unknown or revoked, indistinguishable)
-- or 'rate_limited'. A fixed one minute window allows 30 calls. Counts only usable tokens, so a
-- revoked or unknown token costs nothing and tells nothing.
create function public.use_capture_token(p_hash text)
returns table (status text, user_id uuid, space_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token public.capture_tokens;
  v_hits integer;
  v_space uuid;
begin
  select * into v_token
  from public.capture_tokens t
  where t.token_hash = p_hash and t.revoked_at is null
  for update;

  if not found then
    return query select 'invalid'::text, null::uuid, null::uuid;
    return;
  end if;

  insert into public.capture_rate (token_id, window_start, hits)
  values (v_token.id, now(), 1)
  on conflict (token_id) do update
    set window_start = case
          when public.capture_rate.window_start < now() - interval '1 minute' then now()
          else public.capture_rate.window_start end,
        hits = case
          when public.capture_rate.window_start < now() - interval '1 minute' then 1
          else public.capture_rate.hits + 1 end
  returning hits into v_hits;

  if v_hits > 30 then
    return query select 'rate_limited'::text, null::uuid, null::uuid;
    return;
  end if;

  update public.capture_tokens set last_used_at = now() where id = v_token.id;

  -- the default capture space while the person can still write to it, else their oldest own space
  select s.id into v_space
  from public.profiles p
  join public.spaces s on s.id = p.default_capture_space and s.deleted_at is null
  join public.space_members m on m.space_id = s.id and m.user_id = p.id
  where p.id = v_token.user_id and m.role in ('owner', 'editor');

  if v_space is null then
    select s.id into v_space
    from public.spaces s
    join public.space_members m on m.space_id = s.id and m.user_id = v_token.user_id
    where s.deleted_at is null and m.role in ('owner', 'editor')
    order by (m.role = 'owner') desc, s.created_at
    limit 1;
  end if;

  return query select 'ok'::text, v_token.user_id, v_space;
end;
$$;

revoke all on function public.create_capture_token(text) from public, anon;
revoke all on function public.use_capture_token(text) from public, anon, authenticated;
grant execute on function public.create_capture_token(text) to authenticated;
grant execute on function public.use_capture_token(text) to service_role;
