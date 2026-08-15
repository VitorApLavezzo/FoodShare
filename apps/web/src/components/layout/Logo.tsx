export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="20" className="fill-brand-600" />
      <path
        d="M20 8c-6.6 0-12 5.4-12 12 0 4.9 3 9.1 7.2 10.9.5-3.9 1.9-7.4 4-10.2 2.1-2.8 4.9-5.1 8.1-6.6.4 1.4.7 2.9.7 4.5 0 4.6-2.6 8.6-6.4 10.6"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

export function Logo({ className = '', markClassName = 'h-8 w-8' }: { className?: string; markClassName?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark className={markClassName} />
      <span className="font-display text-lg font-semibold tracking-tight text-neutral-900 dark:text-white">
        FoodShare
      </span>
    </span>
  );
}
