import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const baseInputClass =
  'w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/15 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white dark:focus:ring-brand-500/25';

function FieldWrapper({
  label,
  htmlFor,
  error,
  hint,
  icon,
  rightElement,
  children,
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: ReactNode;
  icon?: ReactNode;
  rightElement?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400">
            {icon}
          </span>
        )}
        {children}
        {rightElement && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightElement}</span>
        )}
      </div>
      {error && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400">{error}</p>
      )}
      {!error && hint && <div className="mt-1.5 text-xs text-neutral-500">{hint}</div>}
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
    <FieldWrapper label={label} htmlFor={id} error={error} hint={hint} icon={icon} rightElement={rightElement}>
      <input
        ref={ref}
        id={id}
        className={`${baseInputClass} ${icon ? 'pl-10' : ''} ${rightElement ? 'pr-10' : ''} ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15' : ''} ${className}`}
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
  hint?: string;
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(
  ({ label, error, hint, className = '', id, ...props }, ref) => (
    <FieldWrapper label={label} htmlFor={id} error={error} hint={hint}>
      <textarea ref={ref} id={id} className={`${baseInputClass} resize-none ${className}`} {...props} />
    </FieldWrapper>
  ),
);
TextareaField.displayName = 'TextareaField';

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(
  ({ label, error, hint, className = '', id, children, ...props }, ref) => (
    <FieldWrapper label={label} htmlFor={id} error={error} hint={hint}>
      <select ref={ref} id={id} className={`${baseInputClass} appearance-none pr-9 ${className}`} {...props}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
        width="16"
        height="16"
        viewBox="0 0 20 20"
        fill="currentColor"
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
