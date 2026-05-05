import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export default function OfflineIndicator() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const u = () => setOnline(navigator.onLine);
    window.addEventListener('online', u);
    window.addEventListener('offline', u);
    return () => { window.removeEventListener('online', u); window.removeEventListener('offline', u); };
  }, []);
  if (online) return null;
  return (
    <div className="bg-amber-500 text-white text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-2 shrink-0">
      <WifiOff className="w-3.5 h-3.5" /> You are offline. Changes will sync when reconnected.
    </div>
  );
}
