import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { format, isValid } from 'date-fns';
import { ArrowLeft, Mail, Phone, CalendarDays, Clock3, TrendingUp, TrendingDown, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import TeamTransactionsPanel from '@/components/admin/TeamTransactionsPanel';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

type Member = {
  id: string; full_name: string | null; email: string | null; phone: string | null;
  is_admin: boolean; is_disabled: boolean; created_at: string; last_sign_in_at: string | null;
  total_income: number | null; total_expense: number | null; tx_count: number | null;
};

const money = (value: number | null) => `${Number(value ?? 0).toLocaleString('en-RW')} RWF`;
const date = (value: string | null, pattern: string) => {
  if (!value) return 'Never';
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, pattern) : 'Unavailable';
};

export default function TeamMemberDetail() {
  const { id } = useParams();
  const { isAdmin, loading: authLoading } = useAuth();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin || !id) return;
    let active = true;
    setLoading(true);
    supabase.rpc('admin_list_users').then(({ data, error: requestError }) => {
      if (!active) return;
      setError(requestError?.message ?? '');
      setMember(((data ?? []) as Member[]).find((item) => item.id === id) ?? null);
      setLoading(false);
    });
    return () => { active = false; };
  }, [id, isAdmin]);

  if (authLoading) return <p className="py-12 text-center text-muted-foreground">Loading…</p>;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" size="sm" asChild><Link to="/team"><ArrowLeft className="mr-2 h-4 w-4" />Team members</Link></Button>
      {loading ? <p className="py-12 text-muted-foreground">Loading member details…</p> : error ? (
        <p role="alert" className="text-destructive">Could not load this member: {error}</p>
      ) : !member ? (
        <p role="alert" className="text-muted-foreground">This member is not available in your team.</p>
      ) : (
        <>
          <header className="border-b pb-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold break-words">{member.full_name || member.email || 'Team member'}</h1>
              <Badge variant={member.is_disabled ? 'destructive' : 'secondary'}>{member.is_disabled ? 'Disabled' : 'Active'}</Badge>
              <Badge variant="outline">{member.is_admin ? 'Admin' : 'Regular user'}</Badge>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {member.email && <span className="inline-flex items-center gap-2 break-all"><Mail className="h-4 w-4 shrink-0" />{member.email}</span>}
              {member.phone && <span className="inline-flex items-center gap-2"><Phone className="h-4 w-4" />{member.phone}</span>}
            </div>
          </header>
          <section aria-label="Member activity" className="grid grid-cols-2 gap-4 border-b pb-6 lg:grid-cols-5">
            <Metric icon={TrendingUp} label="Income" value={money(member.total_income)} />
            <Metric icon={TrendingDown} label="Expense" value={money(member.total_expense)} />
            <Metric icon={ReceiptText} label="Transactions" value={String(member.tx_count ?? 0)} />
            <Metric icon={CalendarDays} label="Joined" value={date(member.created_at, 'MMM d, yyyy')} />
            <Metric icon={Clock3} label="Last active" value={date(member.last_sign_in_at, 'MMM d, h:mm a')} />
          </section>
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Transactions</h2>
            <TeamTransactionsPanel userId={member.id} userName={member.full_name || member.email || 'Member'} />
          </section>
        </>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof TrendingUp; label: string; value: string }) {
  return <div className="min-w-0 space-y-1">
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{label}</span>
    <p className="font-semibold text-foreground break-words">{value}</p>
  </div>;
}