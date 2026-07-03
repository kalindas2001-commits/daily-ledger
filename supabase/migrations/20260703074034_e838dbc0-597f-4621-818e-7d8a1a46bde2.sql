
-- Objects live at path: <request_id>/<uuid>-<filename>
CREATE POLICY "Super admins write assist files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'assist-deliverables' AND is_super_admin(auth.uid()));

CREATE POLICY "Super admins update assist files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'assist-deliverables' AND is_super_admin(auth.uid()));

CREATE POLICY "Super admins delete assist files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'assist-deliverables' AND is_super_admin(auth.uid()));

CREATE POLICY "Read assist files by request access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'assist-deliverables' AND (
      is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.assist_requests r
        WHERE r.id::text = split_part(name, '/', 1)
          AND (r.user_id = auth.uid()
               OR (has_role(auth.uid(),'admin') AND r.tenant_id = get_my_tenant()))
      )
    )
  );
