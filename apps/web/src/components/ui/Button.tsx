import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/**
 * A sombra sólida (`0 2px 0`) sob o botão primário é o único relevo do sistema
 * — nenhum cartão tem sombra. É o que dá ao botão o ar de tecla e separa a ação
 * principal de tudo o que é superfície.
 */
const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    'bg-leaf-800 text-canvas font-bold shadow-[0_2px_0_var(--color-leaf-900)] hover:bg-leaf-600 focus-visible:ring-leaf-600/30 disabled:hover:bg-leaf-800',
  accent:
    'bg-sun-500 text-leaf-800 font-bold hover:bg-sun-400 focus-visible:ring-sun-500/30 disabled:hover:bg-sun-500',
  secondary:
    'border-[1.5px] border-line-bold bg-surface text-leaf-800 font-semibold hover:border-leaf-800 focus-visible:ring-leaf-600/25',
  ghost: 'text-ink-soft font-semibold hover:bg-sand hover:text-leaf-800 focus-visible:ring-leaf-600/25',
  danger: 'text-danger font-semibold hover:bg-danger-50 focus-visible:ring-danger/25',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'px-4 py-2 text-sm',
  md: 'px-[22px] py-2.5 text-[15px]',
  lg: 'px-7 py-3.5 text-base',
};

function buttonClass(variant: Variant, size: Size, className: string) {
  return `inline-flex items-center justify-center gap-2 rounded-full transition focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'sm', loading, disabled, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  ),
);
Button.displayName = 'Button';

/**
 * Navegação com cara de botão. Antes era `<Link><Button/></Link>`: um botão
 * dentro de um link é HTML inválido, conta duas paradas no Tab e o leitor de
 * tela anuncia os dois.
 */
export const ButtonLink = forwardRef<HTMLAnchorElement, LinkProps & { variant?: Variant; size?: Size }>(
  ({ variant = 'primary', size = 'sm', className = '', ...props }, ref) => (
    <Link ref={ref} className={buttonClass(variant, size, className)} {...props} />
  ),
);
ButtonLink.displayName = 'ButtonLink';

/**
 * Ação destrutiva escrita como texto, não como botão cheio: "Cancelar doação"
 * fica ao lado de "Editar" sem disputar peso com ela.
 */
export const InlineDangerButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`rounded-sm text-sm font-semibold text-danger transition hover:underline focus-visible:ring-4 focus-visible:ring-danger/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
);
InlineDangerButton.displayName = 'InlineDangerButton';

/** Ação secundária em texto, no verde de link ("Conversar"). */
export const InlineButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      className={`rounded-sm text-sm font-bold text-leaf-600 transition hover:underline focus-visible:ring-4 focus-visible:ring-leaf-600/25 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  ),
);
InlineButton.displayName = 'InlineButton';
