import type { LucideIcon } from 'lucide-react';
import { Check, LogOut, Monitor, Moon, Sun, UserRound } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '../../../shared/lib/theme';
import { Avatar } from '../../../shared/ui/Avatar';
import { LanguageSelect } from '../../../shared/ui/LanguageSelect';
import { Button, Field } from '../../../shared/ui/ui';
import { useAuth } from '../../auth/application/AuthProvider';
import { useDisplayNameForm } from '../application/useDisplayNameForm';

export function ProfilePage() {
  const { t } = useTranslation('profile');
  const { session } = useAuth();
  if (!session) return null;

  return (
    <>
      <header className="flex items-center gap-4">
        <Avatar
          name={session.displayName}
          email={session.email}
          imageUrl={session.avatarUrl}
          size="lg"
        />
        <div className="grid min-w-0 gap-0.5">
          <p className="text-sm font-medium text-muted">{t('title')}</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
            {session.displayName ?? session.email}
          </h1>
          {session.displayName ? <p className="truncate text-muted">{session.email}</p> : null}
        </div>
      </header>

      <Card title={t('account')}>
        <DisplayNameForm />
      </Card>

      <Card title={t('preferences')}>
        <LanguageSelect variant="field" />
        <ThemePicker />
      </Card>

      <SignOutCard />
    </>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-sm">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function DisplayNameForm() {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation();
  const { name, setName, status, canSave, save } = useDisplayNameForm();
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save();
  };
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <Field
        label={t('displayName')}
        icon={UserRound}
        hint={t('displayNameHint')}
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        maxLength={80}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={!canSave || status === 'saving'}>
          {tc('save')}
        </Button>
        <span role="status" className="text-sm">
          {status === 'saved' ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <Check className="size-4" aria-hidden />
              {t('saved')}
            </span>
          ) : status === 'error' ? (
            <span className="text-danger">{t('saveError')}</span>
          ) : null}
        </span>
      </div>
    </form>
  );
}

const THEME_ICONS: Record<ThemePreference, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};
const THEME_LABELS = {
  system: 'themeSystem',
  light: 'themeLight',
  dark: 'themeDark',
} as const;

function ThemePicker() {
  const { t } = useTranslation('profile');
  const [theme, setTheme] = useTheme();
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-sm font-semibold">{t('theme')}</legend>
      <div className="grid grid-cols-3 gap-2">
        {THEME_PREFERENCES.map((option) => {
          const Icon = THEME_ICONS[option];
          return (
            <label
              key={option}
              className="flex min-h-12 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-line px-2 py-2 text-sm font-semibold text-muted transition has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-accent"
            >
              <input
                type="radio"
                name="theme"
                value={option}
                checked={theme === option}
                onChange={() => setTheme(option)}
                className="sr-only"
              />
              <Icon className="size-5" aria-hidden />
              {t(THEME_LABELS[option])}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function SignOutCard() {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation();
  const { signOut } = useAuth();
  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-card)] border border-line bg-surface p-5">
      <p className="max-w-sm text-sm text-muted">{t('signOutHint')}</p>
      <Button
        variant="secondary"
        icon={<LogOut className="size-5" />}
        onClick={() => void signOut()}
        className="text-danger"
      >
        {tc('signOut')}
      </Button>
    </section>
  );
}
