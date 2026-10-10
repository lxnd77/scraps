-- Phase 5: invites, member listing and realtime for the board.
-- A non-member must be able to join through an invite, which no row policy can express, so the
-- one write path is a security definer function that validates the token itself.

create function public.hash_invite_token(p_token text) returns text
language sql
immutable
set search_path = ''
as $$
  select encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

-- Owners invite editors or viewers; editors invite viewers only. The token is returned once and
-- only its hash is stored.
create function public.create_invite(
  p_space uuid,
  p_role text,
  p_expires_in_days integer default 7,
  p_max_uses integer default 20
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_mine text;
  v_token text;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  if p_role not in ('editor', 'viewer') then
    raise exception 'invalid role' using errcode = '22023';
  end if;
  if p_expires_in_days < 1 or p_expires_in_days > 90 or p_max_uses < 1 or p_max_uses > 200 then
    raise exception 'invalid limits' using errcode = '22023';
  end if;

  select m.role into v_mine
  from public.space_members m
  join public.spaces s on s.id = m.space_id and s.deleted_at is null
  where m.space_id = p_space and m.user_id = v_user;

  if v_mine is null or v_mine = 'viewer' or (v_mine = 'editor' and p_role <> 'viewer') then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.space_invites (space_id, token_hash, role, created_by, expires_at, max_uses)
  values (
    p_space,
    public.hash_invite_token(v_token),
    p_role,
    v_user,
    now() + make_interval(days => p_expires_in_days),
    p_max_uses
  );
  return v_token;
end;
$$;

-- What the accept page shows. Nothing for anything unusable, with no hint why.
create function public.invite_preview(p_token text)
returns table (space_name text, space_color text, role text, inviter_name text, already_member boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select s.name,
         s.color,
         i.role,
         coalesce(nullif(p.display_name, ''), 'someone'),
         exists (
           select 1 from public.space_members m
           where m.space_id = i.space_id and m.user_id = (select auth.uid())
         )
  from public.space_invites i
  join public.spaces s on s.id = i.space_id and s.deleted_at is null
  left join public.profiles p on p.id = i.created_by
  where i.token_hash = public.hash_invite_token(p_token)
    and i.revoked_at is null
    and i.expires_at > now()
    and i.uses < i.max_uses
    and (select auth.uid()) is not null;
$$;

-- Joins the caller to the space. One locked row, so the last use cannot be won twice.
-- Returns the space id, or null when the link is not usable.
create function public.accept_invite(p_token text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_invite public.space_invites;
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  select i.* into v_invite
  from public.space_invites i
  join public.spaces s on s.id = i.space_id and s.deleted_at is null
  where i.token_hash = public.hash_invite_token(p_token)
  for update of i;

  if not found
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or v_invite.uses >= v_invite.max_uses then
    return null;
  end if;

  -- already in: nothing changes, no use is spent, and a role is never downgraded
  if exists (
    select 1 from public.space_members m
    where m.space_id = v_invite.space_id and m.user_id = v_user
  ) then
    return v_invite.space_id;
  end if;

  insert into public.space_members (space_id, user_id, role)
  values (v_invite.space_id, v_user, v_invite.role);
  update public.space_invites set uses = uses + 1 where id = v_invite.id;
  return v_invite.space_id;
end;
$$;

-- Members of one space with the profile fields the share dialog and avatars need.
-- Invoker rights: RLS shows only spaces you are in, and profiles of people you share one with.
create function public.list_space_members(p_space uuid)
returns table (user_id uuid, role text, display_name text, avatar_sticker text, joined_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.user_id, m.role, p.display_name, p.avatar_sticker, m.joined_at
  from public.space_members m
  join public.profiles p on p.id = m.user_id
  where m.space_id = p_space
  order by m.joined_at, m.user_id;
$$;

-- Everyone in every space the caller is in, for the sidebar's avatar stacks.
create function public.space_member_avatars()
returns table (space_id uuid, user_id uuid, display_name text, avatar_sticker text)
language sql
stable
security invoker
set search_path = ''
as $$
  select m.space_id, m.user_id, p.display_name, p.avatar_sticker
  from public.space_members m
  join public.profiles p on p.id = m.user_id
  order by m.joined_at, m.user_id;
$$;

revoke all on function public.hash_invite_token(text) from public, anon, authenticated;
revoke all on function public.create_invite(uuid, text, integer, integer) from public, anon;
revoke all on function public.invite_preview(text) from public, anon;
revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.create_invite(uuid, text, integer, integer) to authenticated;
grant execute on function public.invite_preview(text) to authenticated;
grant execute on function public.accept_invite(text) to authenticated;
grant execute on function public.list_space_members(uuid) to authenticated;
grant execute on function public.space_member_avatars() to authenticated;

-- the board listens for notes from other people; RLS limits what each client is sent
alter publication supabase_realtime add table public.notes;
