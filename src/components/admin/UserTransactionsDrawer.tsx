import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import TeamTransactionsPanel from '@/components/admin/TeamTransactionsPanel';

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string | null;
  userName?: string;
}

export default function UserTransactionsDrawer({ open, onOpenChange, userId, userName }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{userName ? `${userName}'s transactions` : 'Team transactions'}</SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <TeamTransactionsPanel userId={userId} userName={userName} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
