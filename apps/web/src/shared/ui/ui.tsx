import type { LucideIcon } from 'lucide-react';
import { Eye, EyeOff } from 'lucide-react';
import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { Separator } from './separator';

/**
 * App-level form pieces composed from shadcn/ui primitives (Label, Input, Button), so every
 * screen gets the same label, icon, hint and error wiring.
 */

interface FieldProps extends ComponentProps<'input'> {
  label: string;
  icon?: LucideIcon;
  hint?: ReactNode;
  /** Replaces the hint and marks the input invalid for assistive tech. */
  error?: string;
  /** Optional control at the end of the input, e.g. the show-password toggle. */
  trailing?: ReactNode;
}

export function Field({
  label,
  icon: Icon,
  hint,
  error,
  trailing,
  id,
  className,
  ...props
}: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const message = error ?? hint;
  const messageId = message ? `${inputId}-hint` : undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div className="relative">
        {Icon ? (
          <Icon
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        ) : null}
        <Input
          id={inputId}
          aria-describedby={messageId}
          aria-invalid={error ? true : props['aria-invalid']}
          className={cn(Icon && 'pl-11', trailing && 'pr-12', className)}
          {...props}
        />
        {trailing ? (
          <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>
        ) : null}
      </div>
      {message ? (
        <p
          id={messageId}
          className={
            error ? 'text-sm font-medium text-destructive' : 'text-xs text-muted-foreground'
          }
        >
          {message}
        </p>
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="text-muted-foreground"
        >
          <Toggle aria-hidden />
        </Button>
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
  const tones = { accent: 'bg-accent text-accent-foreground', sky: 'bg-sky-soft text-sky' };
  const sizes = {
    md: 'size-12 rounded-2xl [&>svg]:size-6',
    lg: 'size-20 rounded-3xl [&>svg]:size-10',
  };
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center', tones[tone], sizes[size])}
    >
      <Icon />
    </span>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" aria-hidden="true">
      <Separator className="flex-1" />
      {label}
      <Separator className="flex-1" />
    </div>
  );
}
