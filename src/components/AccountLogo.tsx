import { Wallet, Building2, Smartphone, CreditCard, PiggyBank, TrendingUp, Bitcoin } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccountKind } from '@/hooks/useAccounts';

const KIND: Record<AccountKind, { label: string; icon: any; ring: string; bg: string; fg: string; badge?: string }> = {
  CASH:         { label: 'Cash',        icon: Wallet,     ring: 'ring-emerald-500/30', bg: 'bg-gradient-to-br from-emerald-500 to-emerald-600',   fg: 'text-white' },
  BANK:         { label: 'Bank',        icon: Building2,  ring: 'ring-blue-500/30',    bg: 'bg-gradient-to-br from-blue-600 to-blue-800',           fg: 'text-white' },
  MOBILE_MONEY: { label: 'MoMo',        icon: Smartphone, ring: 'ring-amber-500/30',   bg: 'bg-gradient-to-br from-yellow-400 to-amber-500',        fg: 'text-black', badge: 'MoMo' },
  CREDIT_CARD:  { label: 'Credit',      icon: CreditCard, ring: 'ring-purple-500/30',  bg: 'bg-gradient-to-br from-purple-600 to-fuchsia-600',      fg: 'text-white', badge: 'CREDIT' },
  DEBIT_CARD:   { label: 'Debit',       icon: CreditCard, ring: 'ring-indigo-500/30',  bg: 'bg-gradient-to-br from-indigo-600 to-blue-700',         fg: 'text-white', badge: 'DEBIT' },
  SAVINGS:      { label: 'Savings',     icon: PiggyBank,  ring: 'ring-teal-500/30',    bg: 'bg-gradient-to-br from-teal-500 to-emerald-600',        fg: 'text-white' },
  INVESTMENT:   { label: 'Investment',  icon: TrendingUp, ring: 'ring-rose-500/30',    bg: 'bg-gradient-to-br from-rose-500 to-pink-600',           fg: 'text-white' },
  CRYPTO:       { label: 'Crypto',      icon: Bitcoin,    ring: 'ring-orange-500/30',  bg: 'bg-gradient-to-br from-orange-500 to-amber-600',        fg: 'text-white' },
  DIGITAL:      { label: 'Digital',     icon: Wallet,     ring: 'ring-cyan-500/30',    bg: 'bg-gradient-to-br from-cyan-500 to-sky-600',            fg: 'text-white' },
};

export function AccountLogo({ kind, size = 40, className }: { kind: AccountKind; size?: number; className?: string }) {
  const meta = KIND[kind] ?? KIND.CASH;
  const Icon = meta.icon;
  return (
    <div
      className={cn('relative rounded-xl flex items-center justify-center shrink-0 ring-1 shadow-sm', meta.bg, meta.fg, meta.ring, className)}
      style={{ width: size, height: size }}
      aria-label={meta.label}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
      {meta.badge && (
        <span className="absolute -bottom-1 -right-1 text-[8px] font-bold px-1 py-[1px] rounded bg-background text-foreground border shadow-sm">
          {meta.badge}
        </span>
      )}
    </div>
  );
}

export const ACCOUNT_KIND_META = KIND;
