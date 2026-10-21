import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'ghost' | 'link';

const SOLID = 'min-h-12 justify-center rounded-2xl px-5';

// Each variant owns its sizing so classes never conflict (e.g. a link must not get button padding).
const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: `${SOLID} bg-accent text-on-accent shadow-sm hover:brightness-110`,
  secondary: `${SOLID} border border-line bg-surface text-ink hover:border-ink`,
  dark: `${SOLID} bg-ink text-bg hover:opacity-90`,
  ghost: `${SOLID} text-ink hover:bg-line/50`,
  // Text link: still a 44px-tall touch target, but no padding or background.
  link: 'min-h-11 rounded-md text-ink underline underline-offset-4 hover:text-accent',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Leading icon; decorative, so it is hidden from screen readers. */
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  icon,
  className = '',
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center gap-2 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

/** Square icon-only button; `label` is required so screen readers announce it. */
export function IconButton({
  icon: Icon,
  label,
  className = '',
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex size-12 items-center justify-center rounded-2xl border border-line bg-surface text-ink transition hover:border-ink ${className}`}
      {...props}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: LucideIcon;
  hint?: ReactNode;
  /** Optional control at the end of the input, e.g. the show-password toggle. */
  trailing?: ReactNode;
}

export function Field({ label, icon: Icon, hint, trailing, id, ...props }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  return (
    <div className="grid gap-1.5">
      <label htmlFor={inputId} className="text-sm font-semibold">
        {label}
      </label>
      <div className="flex min-h-12 items-center gap-2 rounded-2xl border border-line bg-surface px-4 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        {Icon ? <Icon className="size-5 shrink-0 text-muted" aria-hidden /> : null}
        <input
          id={inputId}
          aria-describedby={hintId}
          className="min-w-0 flex-1 bg-transparent py-3 text-base text-ink outline-none placeholder:text-muted"
          {...props}
        />
        {trailing}
      </div>
      {hint ? (
        <span id={hintId} className="text-xs text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle, which reduces typing mistakes on phones. */
export function PasswordField({
  showLabel,
  hideLabel,
  ...props
}: Omit<FieldProps, 'type' | 'trailing'> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  const Toggle = visible ? EyeOff : Eye;
  return (
    <Field
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="-mr-2 inline-flex size-10 items-center justify-center rounded-xl text-muted hover:text-ink"
        >
          <Toggle className="size-5" aria-hidden />
        </button>
      }
    />
  );
}

/** Rounded tile with an icon: the friendly visual anchor for headers and empty states. */
export function IconTile({
  icon: Icon,
  tone = 'accent',
  size = 'md',
}: {
  icon: LucideIcon;
  tone?: 'accent' | 'sky';
  size?: 'md' | 'lg';
}) {
  const tones = { accent: 'bg-accent-soft text-accent', sky: 'bg-sky-soft text-sky' };
  const sizes = {
    md: 'size-12 rounded-2xl [&>svg]:size-6',
    lg: 'size-20 rounded-3xl [&>svg]:size-10',
  };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center ${tones[tone]} ${sizes[size]}`}
    >
      <Icon />
    </span>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted" aria-hidden="true">
      <span className="h-px flex-1 bg-line" />
      {label}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
