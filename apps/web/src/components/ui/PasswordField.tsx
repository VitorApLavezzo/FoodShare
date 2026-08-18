import { forwardRef, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { InputField } from './Field';
import { checkPassword, getPasswordStrength } from '../../lib/password';

const EyeIcon = ({ open }: { open: boolean }) =>
  open ? (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 3.5c-4.14 0-7.68 2.55-9.16 6.17a.75.75 0 000 .66C2.32 13.95 5.86 16.5 10 16.5s7.68-2.55 9.16-6.17a.75.75 0 000-.66C17.68 6.05 14.14 3.5 10 3.5zM10 14a4 4 0 110-8 4 4 0 010 8z" />
      <circle cx="10" cy="10" r="1.75" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.28 2.22a.75.75 0 00-1.06 1.06l2.2 2.2C1.98 6.87.9 8.3.36 9.83a.75.75 0 000 .66C1.82 13.95 5.36 16.5 9.5 16.5c1.6 0 3.1-.38 4.42-1.06l2.36 2.36a.75.75 0 101.06-1.06L2.28 2.22zM9.5 14a4 4 0 01-3.86-5.02l1.28 1.28a2 2 0 002.32 2.32l1.28 1.28A3.98 3.98 0 019.5 14zm4-4c0 .32-.04.63-.11.93l-3.32-3.32c.3-.07.61-.11.93-.11a2.5 2.5 0 012.5 2.5z" />
      <path d="M14.62 11.66l1.24 1.24C17.5 11.65 18.4 10.4 18.64 9.83a.75.75 0 000-.66C17.18 6.05 13.64 3.5 9.5 3.5c-.86 0-1.7.11-2.5.32l1.4 1.4a5.5 5.5 0 016.22 6.44z" />
    </svg>
  );

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  showStrength?: boolean;
  icon?: ReactNode;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, showStrength, icon, value, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const password = typeof value === 'string' ? value : '';

    return (
      <div>
        <InputField
          ref={ref}
          type={visible ? 'text' : 'password'}
          label={label}
          error={error}
          icon={icon}
          value={value}
          rightElement={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVisible((v) => !v)}
              className="rounded-md p-1.5 text-neutral-400 transition hover:text-neutral-600 dark:hover:text-neutral-200"
              aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            >
              <EyeIcon open={visible} />
            </button>
          }
          {...props}
        />
        {showStrength && password && <PasswordStrengthMeter password={password} />}
      </div>
    );
  },
);
PasswordField.displayName = 'PasswordField';

export function PasswordStrengthMeter({ password }: { password: string }) {
  const strength = getPasswordStrength(password);
  const checks = checkPassword(password);

  const barColor =
    strength === 'forte' ? 'bg-brand-500' : strength === 'média' ? 'bg-amber-500' : 'bg-red-500';
  const barWidth = strength === 'forte' ? 'w-full' : strength === 'média' ? 'w-2/3' : 'w-1/3';
  const labelColor =
    strength === 'forte'
      ? 'text-brand-600 dark:text-brand-400'
      : strength === 'média'
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
          <div className={`h-full rounded-full transition-all ${barColor} ${barWidth}`} />
        </div>
        <span className={`text-xs font-medium capitalize ${labelColor}`}>{strength}</span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <PasswordRequirement met={checks.minLength} label="8+ caracteres" />
        <PasswordRequirement met={checks.hasUppercase} label="1 letra maiúscula" />
        <PasswordRequirement met={checks.hasNumber} label="1 número" />
        <PasswordRequirement met={checks.hasSpecial} label="1 caractere especial" />
      </ul>
    </div>
  );
}

function PasswordRequirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-1 ${met ? 'text-brand-600 dark:text-brand-400' : 'text-neutral-400'}`}>
      <span>{met ? '✓' : '·'}</span>
      {label}
    </li>
  );
}
