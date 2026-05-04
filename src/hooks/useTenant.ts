import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface MyTenantInfo {
  tenant_id: string;
  business_name: string;
  tin_number: string;
  max_users: number;
  current_users: number;
  pending_request: boolean;
  is_owner: boolean;
}

export function useMyTenant() {
  const { user } = useAuth();
  const [info, setInfo] = useState<MyTenantInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) { setInfo(null); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('my_tenant_info');
    if (!error && data && data.length > 0) setInfo(data[0] as MyTenantInfo);
    setLoading(false);
  }, [user]);

  useEffect(() => { reload(); }, [reload]);

  return { info, loading, reload };
}
