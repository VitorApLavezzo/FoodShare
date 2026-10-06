import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

/**
 * Campo de digitação: canto de 16px, não pílula.
 *
 * O sistema separa as duas formas de propósito — pílula é filtro ou ação, que
 * se lê de relance; retângulo arredondado é onde se escreve. Um formulário
 * inteiro de pílulas faria tudo parecer botão.
 */
const baseInputClass =
  'w-full rounded-2xl border-[1.5px] border-line-strong bg-canvas px-3.5 py-3 text-[15px] text-ink transition placeholder:text-ink-faint focus:border-leaf-600 focus:bg-surface focus:ring-4 focus:ring-leaf-600/15 focus:outline-none disabled:border-line disabled:bg-sand-muted disabled:text-ink-muted';

const errorInputClass = 'border-danger focus:border-danger focus:ring-danger/15';

/** Controle de filtro ou barra de ferramentas: pílula, e sempre compacto. */
export const FILTER_CONTROL_CLASS =
  'rounded-full border-[1.5px] border-line-strong bg-canvas px-4 py-2 text-sm text-ink-body transition placeholder:text-ink-faint focus:border-leaf-600 focus:bg-surface focus:ring-4 focus:ring-leaf-600/15 focus:outline-none';

function FieldWrapper({
  label,
  htmlFor,
  error,
  hint,
  icon,
  rightElement,
  required,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  rightElement?: ReactNode;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-body">
          {label}
          {/* Decorativo: o campo já carrega `required`, e repetir "obrigatório"
              no leitor de tela a cada rótulo só atrapalha. */}
          {required && (
            <span aria-hidden="true" className="ml-0.5 text-danger">
              *
            </span>
          )}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute top-1/2 left-3.5 flex -translate-y-1/2 text-ink-faint">
            {icon}
          </span>
        )}
        {children}
        {rightElement && <span className="absolute top-1/2 right-3 -translate-y-1/2">{rightElement}</span>}
      </div>
      {error && <p className="mt-1.5 text-xs font-semibold text-danger">{error}</p>}
      {!error && hint && <div className="mt-1.5 text-xs text-ink-muted">{hint}</div>}
    </div>
  );
}

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  rightElement?: ReactNode;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, hint, icon, rightElement, className = '', id, ...props }, ref) => (
    <FieldWrapper
      label={label}
      htmlFor={id}
      error={error}
      hint={hint}
      icon={icon}
      rightElement={rightElement}
      required={props.required}
    >
      <input
        ref={ref}
        id={id}
        className={`${baseInputClass} ${icon ? 'pl-11' : ''} ${rightElement ? 'pr-11' : ''} ${error ? errorInputClass : ''} ${className}`}
        aria-invalid={!!error}
        {...props}
      />
    </FieldWrapper>
  ),
);
InputField.displayName = 'InputField';

interface TextareaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => (
    <FieldWrapper label={label} htmlFor={id} error={error} hint={hint} required={props.required}>
      <textarea
        ref={ref}
        id={id}
        className={`${baseInputClass} resize-none ${error ? errorInputClass : ''} ${className}`}
        aria-invalid={!!error}
        {...props}
      />
    </FieldWrapper>
  ),
);
TextareaField.displayName = 'TextareaField';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: ReactNode;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, className = '', id, children, ...props }, ref) => (
    <FieldWrapper label={label} htmlFor={id} error={error} hint={hint} required={props.required}>
      <select
        ref={ref}
        id={id}
        className={`${baseInputClass} appearance-none pr-10 ${error ? errorInputClass : ''} ${className}`}
        aria-invalid={!!error}
        {...props}
      >
        {children}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink-faint"
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </FieldWrapper>
  ),
);
SelectField.displayName = 'SelectField';
