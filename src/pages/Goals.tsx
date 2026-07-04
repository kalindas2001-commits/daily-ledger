import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Target, Car, Home, Heart, Plane, Shield, GraduationCap, Briefcase } from 'lucide-react';
import { useGoals, useCreateGoal, useDeleteGoal, useContributeToGoal } from '@/hooks/useGoals';

const CATEGORIES = [
  { value: 'car', label: 'Buy Car', icon: Car },
  { value: 'house', label: 'Build House', icon: Home },
  { value: 'wedding', label: 'Wedding', icon: Heart },
  { value: 'vacation', label: 'Vacation', icon: Plane },
  { value: 'emergency', label: 'Emergency Fund', icon: Shield },
  { value: 'education', label: 'Education', icon: GraduationCap },
  { value: 'business', label: 'Business Startup', icon: Briefcase },
  { value: 'other', label: 'Other', icon: Target },
];

const iconFor = (cat: string | null) => CATEGORIES.find(c => c.value === cat)?.icon ?? Target;
const fmt = (n: number) => n.toLocaleString('en-RW', { minimumFractionDigits: 0 });

export default function GoalsPage() {
  const { data: goals } = useGoals();
  const create = useCreateGoal();
  const del = useDeleteGoal();
  const contribute = useContributeToGoal();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [category, setCategory] = useState('emergency');
  const [target, setTarget] = useState(0); const [targetDate, setTargetDate] = useState('');
  const [contribGoal, setContribGoal] = useState<string | null>(null);
  const [contribAmount, setContribAmount] = useState(0);

  const submit = async () => {
    if (!name.trim() || target <= 0) return toast.error('Fill required fields');
    try {
      await create.mutateAsync({ name: name.trim(), category, target_amount: target, target_date: targetDate || undefined });
      toast.success('Goal created'); setOpen(false); setName(''); setTarget(0); setTargetDate('');
    } catch (e: any) { toast.error(e.message); }
  };

  const doContribute = async () => {
    if (!contribGoal || contribAmount <= 0) return;
    try {
      await contribute.mutateAsync({ goal_id: contribGoal, amount: contribAmount });
      toast.success('Contribution added'); setContribGoal(null); setContribAmount(0);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div><h2 className="text-2xl font-bold">Financial Goals</h2><p className="text-sm text-muted-foreground">Dream. Save. Achieve.</p></div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> New Goal</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Financial Goal</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Goal name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Buy a car" /></div>
              <div><Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Target amount (RWF)</Label><Input type="number" value={target || ''} onChange={e => setTarget(+e.target.value)} /></div>
              <div><Label>Target date (optional)</Label><Input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} /></div>
              <Button onClick={submit} className="w-full" disabled={create.isPending}>Create Goal</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {goals?.map(g => {
          const Icon = iconFor(g.category);
          const pct = Math.min(100, (Number(g.current_amount) / Number(g.target_amount)) * 100);
          const remaining = Math.max(0, Number(g.target_amount) - Number(g.current_amount));
          return (
            <Card key={g.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Icon className="w-5 h-5" /></div>
                  <div className="flex-1"><CardTitle className="text-base">{g.name}</CardTitle>{g.status === 'completed' && <Badge className="mt-1 bg-income">✓ Achieved</Badge>}</div>
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(g.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1"><span className="text-muted-foreground">{fmt(Number(g.current_amount))} / {fmt(Number(g.target_amount))} RWF</span><span className="font-medium">{pct.toFixed(0)}%</span></div>
                  <Progress value={pct} />
                  <p className="text-xs text-muted-foreground mt-1">{remaining > 0 ? `${fmt(remaining)} RWF to go` : 'Goal reached!'}{g.target_date && ` • by ${new Date(g.target_date).toLocaleDateString()}`}</p>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setContribGoal(g.id)}>+ Add Contribution</Button>
              </CardContent>
            </Card>
          );
        })}
        {!goals?.length && <p className="text-sm text-muted-foreground col-span-2 text-center py-8">No goals yet. Set your first financial goal.</p>}
      </div>

      <Dialog open={!!contribGoal} onOpenChange={o => !o && setContribGoal(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add contribution</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Amount (RWF)</Label><Input type="number" value={contribAmount || ''} onChange={e => setContribAmount(+e.target.value)} autoFocus /></div>
            <Button onClick={doContribute} className="w-full" disabled={contribute.isPending}>Contribute</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
