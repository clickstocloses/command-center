-- Postgres grants EXECUTE on new functions to PUBLIC, so revoking from anon
-- alone (as the foundation migration did) changed nothing. Lock the security
-- definer helpers to the roles that need them: policies run as the calling
-- role, so authenticated must keep EXECUTE or every staff policy breaks.

revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.is_owner() from public, anon;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.is_owner() to authenticated, service_role;

-- current_client_id is security invoker and only reads the caller's own JWT,
-- but there's no reason for anonymous callers to have it either.
revoke execute on function public.current_client_id() from public, anon;
grant execute on function public.current_client_id() to authenticated, service_role;
