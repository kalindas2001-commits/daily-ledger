import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import TenantsOverview from '@/components/admin/TenantsOverview';
import PasswordResetRequests from '@/components/admin/PasswordResetRequests';
import Dashboard from '@/pages/Dashboard';
import AdminNotificationsManager from '@/components/AdminNotificationsManager';
import { Building2, LayoutDashboard, KeyRound, Bell } from 'lucide-react';

export default function Admin() {
  const { isSuperAdmin, loading } = useAuth();
  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  if (!isSuperAdmin) return <Navigate to="/" replace />;

  return (
    <Tabs defaultValue="tenants" className="space-y-4">
      <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
        <TabsTrigger value="tenants" className="gap-1.5"><Building2 className="w-4 h-4" /> Tenants</TabsTrigger>
        <TabsTrigger value="dashboard" className="gap-1.5"><LayoutDashboard className="w-4 h-4" /> My Dashboard</TabsTrigger>
        <TabsTrigger value="resets" className="gap-1.5"><KeyRound className="w-4 h-4" /> Password Resets</TabsTrigger>
        <TabsTrigger value="broadcasts" className="gap-1.5"><Bell className="w-4 h-4" /> Broadcasts</TabsTrigger>
      </TabsList>

      <TabsContent value="tenants" className="space-y-6">
        <TenantsOverview />
      </TabsContent>

      <TabsContent value="dashboard">
        <Dashboard />
      </TabsContent>

      <TabsContent value="resets">
        <PasswordResetRequests />
      </TabsContent>

      <TabsContent value="broadcasts">
        <AdminNotificationsManager />
      </TabsContent>
    </Tabs>
  );
}
