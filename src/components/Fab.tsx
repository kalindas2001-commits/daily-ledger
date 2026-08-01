import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, PlusCircle, PiggyBank, HandCoins, StickyNote, Users, FileDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

export default function Fab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const actions = [
    { label: 'New transaction', icon: PlusCircle, path: '/add' },
    { label: 'Savings entry', icon: PiggyBank, path: '/savings' },
    { label: 'Loan action', icon: HandCoins, path: '/loans' },
    { label: 'Daily note', icon: StickyNote, path: '/notes' },
    { label: 'Export report', icon: FileDown, path: '/export' },
    ...(isAdmin ? [{ label: 'Team', icon: Users, path: '/team' }] : []),
  ];

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
      )}
      <div className="fixed z-50 right-4 bottom-[76px] lg:bottom-6 flex flex-col items-end gap-2">
        {open && actions.map((a, i) => (
          <button
            key={a.path}
            onClick={() => go(a.path)}
            style={{ animationDelay: `${i * 30}ms` }}
            className="animate-fade-in flex items-center gap-2 pl-3 pr-4 py-2 rounded-full bg-card border shadow-lg text-sm font-medium hover:bg-muted transition-colors"
          >
            <a.icon className="w-4 h-4 text-primary" />
            {a.label}
          </button>
        ))}
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close quick actions' : 'Quick actions'}
          className={cn(
            'w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center transition-transform active:scale-95',
            open && 'rotate-90'
          )}
        >
          {open ? <X className="w-6 h-6" /> : <Plus className="w-7 h-7" />}
        </button>
      </div>
    </>
  );
}
