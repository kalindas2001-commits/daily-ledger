REVOKE EXECUTE ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_disabled(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_global_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.assign_default_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_disabled(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;