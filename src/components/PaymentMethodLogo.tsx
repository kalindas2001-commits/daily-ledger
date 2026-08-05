import {
  Banknote, Smartphone, Building2, CreditCard, Wallet, Bitcoin, ScrollText, QrCode, Apple,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type Meta = { icon: any; bg: string; fg: string; short?: string };

const METHODS: Record<string, Meta> = {
  'Cash':          { icon: Banknote,   bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600', fg: 'text-white' },
  'Mobile Money':  { icon: Smartphone, bg: 'bg-gradient-to-br from-yellow-400 to-amber-500',    fg: 'text-black', short: 'MoMo' },
  'Bank Transfer': { icon: Building2,  bg: 'bg-gradient-to-br from-blue-600 to-blue-800',       fg: 'text-white' },
  'Card':          { icon: CreditCard, bg: 'bg-gradient-to-br from-slate-600 to-slate-800',     fg: 'text-white' },
  'Visa':          { icon: CreditCard, bg: 'bg-gradient-to-br from-blue-700 to-indigo-800',     fg: 'text-white', short: 'VISA' },
  'MasterCard':    { icon: CreditCard, bg: 'bg-gradient-to-br from-orange-500 to-red-600',      fg: 'text-white', short: 'MC' },
  'Apple Pay':     { icon: Apple,      bg: 'bg-gradient-to-br from-neutral-800 to-black',       fg: 'text-white' },
  'Google Pay':    { icon: Wallet,     bg: 'bg-gradient-to-br from-sky-500 to-emerald-500',     fg: 'text-white', short: 'GPay' },
  'PayPal':        { icon: Wallet,     bg: 'bg-gradient-to-br from-sky-600 to-blue-800',        fg: 'text-white', short: 'PP' },
  'Crypto':        { icon: Bitcoin,    bg: 'bg-gradient-to-br from-orange-400 to-amber-600',    fg: 'text-white' },
  'Cheque':        { icon: ScrollText, bg: 'bg-gradient-to-br from-teal-500 to-cyan-700',       fg: 'text-white' },
  'QR Payment':    { icon: QrCode,     bg: 'bg-gradient-to-br from-fuchsia-500 to-purple-700',  fg: 'text-white' },
};

export const PAYMENT_METHODS = Object.keys(METHODS);
export const CORE_PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Bank Transfer', 'Card'];

export function PaymentMethodLogo({ method, size = 22, className }: { method?: string | null; size?: number; className?: string }) {
  const meta = METHODS[method ?? ''] ?? { icon: Wallet, bg: 'bg-secondary', fg: 'text-secondary-foreground' };
  const Icon = meta.icon ?? Wallet;
  return (
    <span
      className={cn('inline-flex items-center justify-center rounded-md shrink-0 shadow-sm ring-1 ring-border', meta.bg, meta.fg, className)}
      style={{ width: size, height: size }}
      aria-label={method || 'Payment method'}
      title={method || 'Payment method'}
    >
      <Icon style={{ width: size * 0.6, height: size * 0.6 }} />
    </span>
  );
}


export function PaymentMethodOption({ method }: { method: string }) {
  return (
    <span className="flex items-center gap-2">
      <PaymentMethodLogo method={method} size={20} />
      <span>{method}</span>
    </span>
  );
}
