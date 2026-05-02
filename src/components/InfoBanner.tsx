import { useNotifications } from '@/hooks/useNotifications';
import { Info, X } from 'lucide-react';

export default function InfoBanner() {
  const { visibleBanners, dismiss } = useNotifications();
  if (visibleBanners.length === 0) return null;
  const n = visibleBanners[0];

  return (
    <div className="bg-primary text-primary-foreground border-b border-primary/30 animate-slide-down">
      <div className="px-4 py-2 flex items-start gap-3 max-w-6xl mx-auto">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-primary-foreground/20 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
          <Info className="w-3 h-3" /> INFO
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold truncate">{n.title}</div>
          <div className="text-xs opacity-90 line-clamp-2">{n.body}</div>
        </div>
        <button
          onClick={() => dismiss(n.id)}
          className="shrink-0 p-1 rounded hover:bg-primary-foreground/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
