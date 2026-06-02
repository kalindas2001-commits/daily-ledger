import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import PlatformOverview from '@/components/admin/PlatformOverview';
import TenantsOverview from '@/components/admin/TenantsOverview';
import PasswordResetRequests from '@/components/admin/PasswordResetRequests';
import QuotaRequests from '@/components/admin/QuotaRequests';
import RoleManagement from '@/components/admin/RoleManagement';
import AuditLogs from '@/components/admin/AuditLogs';
import SystemHealth from '@/components/admin/SystemHealth';
import AdminNotificationsManager from '@/components/AdminNotificationsManager';
import { Building2, LayoutDashboard, KeyRound, Bell, Users, Shield, ScrollText, Activity } from 'lucide-react';

export default function Admin() {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto w-full justify-start gap-1">
        <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="w-4 h-4" /> Overview</TabsTrigger>
        <TabsTrigger value="tenants" className="gap-1.5"><Building2 className="w-4 h-4" /> Tenants</TabsTrigger>
        <TabsTrigger value="system" className="gap-1.5"><Activity className="w-4 h-4" /> System Health</TabsTrigger>
        <TabsTrigger value="roles" className="gap-1.5"><Shield className="w-4 h-4" /> Roles</TabsTrigger>
        <TabsTrigger value="quotas" className="gap-1.5"><Users className="w-4 h-4" /> Quotas</TabsTrigger>
        <TabsTrigger value="resets" className="gap-1.5"><KeyRound className="w-4 h-4" /> Password Resets</TabsTrigger>
        <TabsTrigger value="audit" className="gap-1.5"><ScrollText className="w-4 h-4" /> Audit Logs</TabsTrigger>
        <TabsTrigger value="broadcasts" className="gap-1.5"><Bell className="w-4 h-4" /> Broadcasts</TabsTrigger>
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

