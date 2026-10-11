-- Phase 9: account deletion. Deleting a profile cascades to the spaces it owns, so a shared space
-- the owner wants to keep must change owner first. Service role only: the delete-account Edge
-- Function applies the person's choices after verifying who they are.

create function public.account_transfer_space(p_from uuid, p_space uuid, p_to uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = p_from and m.role = 'owner'
  ) then
    raise exception 'not the owner' using errcode = '42501';
  end if;
  if p_to = p_from or not exists (
    select 1 from public.space_members m
    where m.space_id = p_space and m.user_id = p_to and m.role in ('editor', 'owner')
  ) then
    raise exception 'the new owner must be an editor of the space' using errcode = '22023';
  end if;

  update public.space_members set role = 'owner'
  where space_id = p_space and user_id = p_to;
  update public.space_members set role = 'editor'
  where space_id = p_space and user_id = p_from;
  update public.spaces set owner_id = p_to where id = p_space;
end;
$$;

revoke all on function public.account_transfer_space(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.account_transfer_space(uuid, uuid, uuid) to service_role;
