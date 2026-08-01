import { cn } from '@/lib/utils';

/** Crisp inline SVG flags — emoji flags don't render on Windows/Chrome desktop. */
export function Flag({ code, className, size = 18 }: { code: string; className?: string; size?: number }) {
  const style = { width: size, height: size * 0.7 };
  const wrap = (children: React.ReactNode) => (
    <svg viewBox="0 0 30 21" style={style} className={cn('rounded-[2px] ring-1 ring-black/10 shrink-0', className)} aria-label={code}>
      {children}
    </svg>
  );

  if (code === 'fr') {
    return wrap(<>
      <rect width="10" height="21" fill="#0055A4" />
      <rect x="10" width="10" height="21" fill="#fff" />
      <rect x="20" width="10" height="21" fill="#EF4135" />
    </>);
  }
  if (code === 'rw') {
    return wrap(<>
      <rect width="30" height="10" fill="#00A1DE" />
      <rect y="10" width="30" height="5" fill="#FAD201" />
      <rect y="15" width="30" height="6" fill="#20603D" />
      <circle cx="24" cy="5.5" r="2.6" fill="#FAD201" />
    </>);
  }
  // en → Union Jack (simplified)
  return wrap(<>
    <rect width="30" height="21" fill="#012169" />
    <path d="M0,0 L30,21 M30,0 L0,21" stroke="#fff" strokeWidth="4" />
    <path d="M0,0 L30,21 M30,0 L0,21" stroke="#C8102E" strokeWidth="2" />
    <path d="M15,0 V21 M0,10.5 H30" stroke="#fff" strokeWidth="6" />
    <path d="M15,0 V21 M0,10.5 H30" stroke="#C8102E" strokeWidth="3.5" />
  </>);
}
