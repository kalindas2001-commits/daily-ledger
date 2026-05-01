import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, User, BarChart3, RefreshCw } from 'lucide-react';

// Bump this version whenever you want all users to see the popup again.
const CURRENT_VERSION = '2026.05.01';
const STORAGE_KEY = 'cungacash:whatsnew_seen';

const ITEMS = [
  {
    icon: User,
    title: 'New Profile & Settings page',
    desc: 'Upload a profile picture, view your role, session status, and the exact date you joined.',
  },
  {
    icon: BarChart3,
    title: 'Smarter Admin Analytics',
    desc: 'Filter global stats by date range, type, and category. Drill into trends with interactive charts.',
  },
  {
    icon: RefreshCw,
    title: 'Auto-updates for installed app',
    desc: 'The app refreshes its name and logo automatically — no need to uninstall or reinstall.',
  },
];

export default function WhatsNewDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== CURRENT_VERSION) {
      // Slight delay so it doesn't flash during initial render
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <DialogTitle className="text-lg">What's new in CungaCash</DialogTitle>
          </div>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {ITEMS.map((it) => (
            <div key={it.title} className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-primary">
                <it.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{it.title}</div>
                <p className="text-xs text-muted-foreground leading-relaxed">{it.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={dismiss} className="w-full">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
