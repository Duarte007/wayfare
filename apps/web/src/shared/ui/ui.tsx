import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Button({
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'link' }) {
  const styles = {
    primary: 'bg-ink text-bg hover:opacity-90',
    secondary: 'border border-line bg-surface text-ink hover:border-ink',
    link: 'text-ink underline underline-offset-4 min-h-0 px-0',
  }[variant];
  return (
    <button
      className={`min-h-11 rounded-lg px-4 font-semibold disabled:opacity-50 ${styles} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      <input
        className="min-h-11 rounded-lg border border-line bg-surface px-3 text-base text-ink outline-none focus:border-ink"
        {...props}
      />
      {hint ? <span className="text-xs font-normal text-muted">{hint}</span> : null}
    </label>
  );
}
