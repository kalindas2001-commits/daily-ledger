import { Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import mtnAsset from '@/assets/payments/MTN_MOMO.jpg.asset.json';
import airtelAsset from '@/assets/payments/AIRTEL_MONEY.jpg.asset.json';
import visaAsset from '@/assets/payments/VISA.png.asset.json';
import mastercardAsset from '@/assets/payments/MASTERCARD.webp.asset.json';
import paypalAsset from '@/assets/payments/PAYPAL.jpg.asset.json';
import chequeAsset from '@/assets/payments/BANK_CHEQUE.avif.asset.json';

type Meta = { src: string; bg: string };

const METHODS: Record<string, Meta> = {
  'MTN MOMO': { src: mtnAsset.url, bg: 'bg-[#ffcc00]' },
  'AIRTEL MONEY': { src: airtelAsset.url, bg: 'bg-[#e40000]' },
  'VISA': { src: visaAsset.url, bg: 'bg-white' },
  'MASTERCARD': { src: mastercardAsset.url, bg: 'bg-white' },
  'PAYPAL': { src: paypalAsset.url, bg: 'bg-white' },
  'BANK CHEQUE': { src: chequeAsset.url, bg: 'bg-white' },
};

export const PAYMENT_METHODS = Object.keys(METHODS);
export const CORE_PAYMENT_METHODS = PAYMENT_METHODS;

export function PaymentMethodLogo({ method, size = 22, className }: { method?: string | null; size?: number; className?: string }) {
  const meta = METHODS[String(method ?? '').toUpperCase()];

  if (!meta) {
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

  return (
    <span
      className={cn('inline-flex items-center justify-center overflow-hidden rounded-md shrink-0 shadow-sm ring-1 ring-border', meta.bg, className)}
      style={{ width: size, height: size }}
      title={method || 'Payment method'}
    >
      <img
        src={meta.src}
        alt={`${method} logo`}
        loading="lazy"
        className="h-full w-full object-contain p-[2px]"
      />
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
