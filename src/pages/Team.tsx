import TeamMembers from '@/components/admin/TeamMembers';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

export default function TeamPage() {
  const { isAdmin, loading } = useAuth();
  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <TeamMembers />;
}
