import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Inline SVG brand marks — no network requests, always render crisply.
 * Each mark draws inside a 40x24 box so they align in selectors and lists.
 */
type Mark = (props: { className?: string }) => JSX.Element;

const Box = ({ children, bg }: { children: React.ReactNode; bg: string }) => (
  <svg viewBox="0 0 40 24" width="100%" height="100%" role="presentation" preserveAspectRatio="xMidYMid meet">
    <rect x="0" y="0" width="40" height="24" rx="4" fill={bg} />
    {children}
  </svg>
);

const MtnMomo: Mark = () => (
  <Box bg="#FFCC00">
    <ellipse cx="20" cy="12" rx="14" ry="8" fill="#000000" />
    <text x="20" y="15.4" textAnchor="middle" fontSize="8.5" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif" fill="#FFCC00">MTN</text>
  </Box>
);

const AirtelMoney: Mark = () => (
  <Box bg="#E40000">
    <text x="20" y="15.8" textAnchor="middle" fontSize="9" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif" fill="#FFFFFF">airtel</text>
  </Box>
);

const Visa: Mark = () => (
  <Box bg="#FFFFFF">
    <rect x="0" y="0" width="40" height="24" rx="4" fill="#FFFFFF" stroke="#E5E7EB" />
    <text x="19" y="16" textAnchor="middle" fontSize="10" fontStyle="italic" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif" fill="#1A1F71">VISA</text>
    <rect x="8" y="17.5" width="24" height="1.8" fill="#F7B600" />
  </Box>
);

const Mastercard: Mark = () => (
  <Box bg="#FFFFFF">
    <rect x="0" y="0" width="40" height="24" rx="4" fill="#FFFFFF" stroke="#E5E7EB" />
    <circle cx="16.5" cy="12" r="7" fill="#EB001B" />
    <circle cx="23.5" cy="12" r="7" fill="#F79E1B" />
    <path d="M20 5.9a7 7 0 0 0 0 12.2 7 7 0 0 0 0-12.2z" fill="#FF5F00" />
  </Box>
);

const Paypal: Mark = () => (
  <Box bg="#FFFFFF">
    <rect x="0" y="0" width="40" height="24" rx="4" fill="#FFFFFF" stroke="#E5E7EB" />
    <text x="18" y="16" textAnchor="middle" fontSize="9.5" fontStyle="italic" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif" fill="#003087">Pay</text>
    <text x="29" y="16" textAnchor="middle" fontSize="9.5" fontStyle="italic" fontWeight="700" fontFamily="Helvetica, Arial, sans-serif" fill="#009CDE">Pal</text>
  </Box>
);

const BankCheque: Mark = () => (
  <Box bg="#FFFFFF">
    <rect x="5" y="6" width="30" height="12" rx="1.5" fill="#FFFFFF" stroke="#94A3B8" />
    <rect x="7.5" y="8.5" width="12" height="1.6" fill="#0D9668" />
    <rect x="7.5" y="12" width="18" height="1.4" fill="#CBD5E1" />
    <rect x="7.5" y="14.8" width="10" height="1.4" fill="#CBD5E1" />
    <rect x="26" y="8.5" width="7" height="4" rx="0.8" fill="#0D9668" opacity="0.15" />
  </Box>
);

const METHODS: Record<string, { mark: Mark; bg: string }> = {
  'MTN MOMO': { mark: MtnMomo, bg: '#FFCC00' },
  'AIRTEL MONEY': { mark: AirtelMoney, bg: '#E40000' },
  'VISA': { mark: Visa, bg: '#FFFFFF' },
  'MASTERCARD': { mark: Mastercard, bg: '#FFFFFF' },
  'PAYPAL': { mark: Paypal, bg: '#FFFFFF' },
  'BANK CHEQUE': { mark: BankCheque, bg: '#FFFFFF' },
};

export const PAYMENT_METHODS = Object.keys(METHODS);
export const CORE_PAYMENT_METHODS = PAYMENT_METHODS;

export function PaymentMethodLogo({ method, size = 22, className }: { method?: string | null; size?: number; className?: string }) {
  const entry = METHODS[String(method ?? '').toUpperCase()];

  if (!entry) {
    return (
      <span
        className={cn('inline-flex items-center justify-center rounded-md shrink-0 shadow-sm ring-1 ring-border bg-secondary text-secondary-foreground', className)}
        style={{ width: size, height: size }}
        aria-label={method || 'Payment method'}
        title={method || 'Payment method'}
      >
        <Wallet style={{ width: size * 0.6, height: size * 0.6 }} />
      </span>
    );
  }

  const Mark = entry.mark;

  return (
    <span
      className={cn('inline-flex items-center justify-center overflow-hidden rounded-md shrink-0 shadow-sm ring-1 ring-black/10', className)}
      style={{ width: size * 1.5, height: size, backgroundColor: entry.bg }}
      title={method || 'Payment method'}
      aria-label={`${method} logo`}
    >
      <Mark />
    </span>
  );
}

export function PaymentMethodOption({ method }: { method: string }) {
  return (
    <span className="flex items-center gap-3">
      <PaymentMethodLogo method={method} size={18} />
      <span className="leading-none">{method}</span>
    </span>
  );
}

