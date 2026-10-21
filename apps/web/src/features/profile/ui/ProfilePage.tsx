import type { LucideIcon } from 'lucide-react';
import { Check, LogOut, Monitor, Moon, Sun, TriangleAlert, UserRound } from 'lucide-react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { THEME_PREFERENCES, useTheme, type ThemePreference } from '@/shared/lib/theme';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card';
import { LanguageSelect } from '@/shared/ui/LanguageSelect';
import { Label } from '@/shared/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { Field } from '@/shared/ui/ui';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import { useAuth } from '../../auth/application/AuthProvider';
import { useSync } from '../../sync/application/SyncProvider';
import { useDisplayNameForm } from '../application/useDisplayNameForm';

export function ProfilePage() {
  const { t } = useTranslation('profile');
  const { session } = useAuth();
  if (!session) return null;

  return (
    <>
      <header className="flex items-center gap-4">
        <UserAvatar
          name={session.displayName}
          email={session.email}
          imageUrl={session.avatarUrl}
          size="lg"
        />
        <div className="grid min-w-0 gap-0.5">
          <p className="text-sm font-medium text-muted-foreground">{t('title')}</p>
          <h1 className="truncate text-2xl font-extrabold tracking-tight sm:text-3xl">
            {session.displayName ?? session.email}
          </h1>
          {session.displayName ? (
            <p className="truncate text-muted-foreground">{session.email}</p>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t('account')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DisplayNameForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>{t('preferences')}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          <LanguageSelect variant="field" />
          <ThemePicker />
        </CardContent>
      </Card>

      <SignOutCard />
    </>
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
            <span className="text-destructive">{t('saveError')}</span>
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
    <div className="grid gap-2">
      <Label id="theme-label">{t('theme')}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        size="lg"
        aria-labelledby="theme-label"
        value={theme}
        // Radix sends '' when the active item is pressed again; keep a theme selected.
        onValueChange={(value) => value && setTheme(value as ThemePreference)}
        className="grid w-full grid-cols-3"
      >
        {THEME_PREFERENCES.map((option) => {
          const Icon = THEME_ICONS[option];
          return (
            <ToggleGroupItem key={option} value={option} className="flex-col gap-1 py-2 text-sm">
              <Icon aria-hidden />
              {t(THEME_LABELS[option])}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </div>
  );
}

function SignOutCard() {
  const { t } = useTranslation('profile');
  const { t: tc } = useTranslation();
  const { signOut } = useAuth();
  const { pending } = useSync();
  return (
    <Card className="py-5">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 px-5">
        {pending > 0 ? (
          <Alert variant="destructive" role="alert" className="max-w-md">
            <TriangleAlert aria-hidden />
            <AlertDescription>{t('signOutPending', { count: pending })}</AlertDescription>
          </Alert>
        ) : (
          <p className="max-w-sm text-sm text-muted-foreground">{t('signOutHint')}</p>
        )}
        <Button variant="outline" onClick={() => void signOut()} className="text-destructive">
          <LogOut aria-hidden />
          {tc('signOut')}
        </Button>
      </CardContent>
    </Card>
  );
}
