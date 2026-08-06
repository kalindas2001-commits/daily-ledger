GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transactions TO authenticated;
GRANT ALL ON TABLE public.transactions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT ALL ON TABLE public.categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.transaction_edit_requests TO authenticated;
GRANT ALL ON TABLE public.transaction_edit_requests TO service_role;

GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;