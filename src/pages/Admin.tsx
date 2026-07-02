import { useEffect, useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import PlatformOverview from '@/components/admin/PlatformOverview';
import TenantsOverview from '@/components/admin/TenantsOverview';
import PasswordResetRequests from '@/components/admin/PasswordResetRequests';
import QuotaRequests from '@/components/admin/QuotaRequests';
import RoleManagement from '@/components/admin/RoleManagement';
import AuditLogs from '@/components/admin/AuditLogs';
import SystemHealth from '@/components/admin/SystemHealth';
import AdminNotificationsManager from '@/components/AdminNotificationsManager';
import AssistRequestsAdmin from '@/components/admin/AssistRequests';
import { Building2, LayoutDashboard, KeyRound, Bell, Users, Shield, ScrollText, Activity, Sparkles } from 'lucide-react';

export default function Admin() {
  const { isSuperAdmin, loading } = useAuth();
  const { t } = useTranslation();
  const [pendingResets, setPendingResets] = useState(0);
  const [pendingQuotas, setPendingQuotas] = useState(0);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let mounted = true;
    const load = async () => {
      const { data } = await supabase.rpc('super_admin_platform_pulse');
      if (mounted && data) {
        setPendingResets(Number((data as any).pending_resets ?? 0));
        setPendingQuotas(Number((data as any).pending_quotas ?? 0));
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(t); };
  }, [isSuperAdmin]);

  if (loading) return <div className="text-center py-12 text-muted-foreground">{t('common.loading')}</div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1">
        <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="w-4 h-4" /> {t('admin.overview')}</TabsTrigger>
        <TabsTrigger value="tenants" className="gap-1.5"><Building2 className="w-4 h-4" /> {t('admin.tenants')}</TabsTrigger>
        <TabsTrigger value="system" className="gap-1.5"><Activity className="w-4 h-4" /> {t('admin.systemHealth')}</TabsTrigger>
        <TabsTrigger value="roles" className="gap-1.5"><Shield className="w-4 h-4" /> {t('admin.roles')}</TabsTrigger>
        <TabsTrigger value="quotas" className="gap-1.5">
          <Users className="w-4 h-4" /> {t('admin.quotas')}
          {pendingQuotas > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendingQuotas}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="resets" className="gap-1.5">
          <KeyRound className="w-4 h-4" /> {t('admin.passwordResets')}
          {pendingResets > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">{pendingResets}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="w-4 h-4" /> {t('admin.auditLogs')}</TabsTrigger>
        <TabsTrigger value="broadcasts" className="gap-1.5"><Bell className="w-4 h-4" /> {t('admin.broadcasts')}</TabsTrigger>
      </TabsList>

      <TabsContent value="overview"><PlatformOverview /></TabsContent>
      <TabsContent value="tenants" className="space-y-6"><TenantsOverview /></TabsContent>
      <TabsContent value="system"><SystemHealth /></TabsContent>
      <TabsContent value="roles"><RoleManagement /></TabsContent>
      <TabsContent value="quotas"><QuotaRequests /></TabsContent>
      <TabsContent value="resets"><PasswordResetRequests /></TabsContent>
      <TabsContent value="audit"><AuditLogs /></TabsContent>
      <TabsContent value="broadcasts"><AdminNotificationsManager /></TabsContent>
    </Tabs>
  );
}
