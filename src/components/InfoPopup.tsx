import { useNotifications } from '@/hooks/useNotifications';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';

export default function InfoPopup() {
  const { pendingPopups, dismiss } = useNotifications();
  const n = pendingPopups[0];
  if (!n) return null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) dismiss(n.id); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary">
              <Info className="w-4 h-4" />
            </span>
            {n.title}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm whitespace-pre-wrap">{n.body}</p>
        <DialogFooter>
          <Button onClick={() => dismiss(n.id)}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
