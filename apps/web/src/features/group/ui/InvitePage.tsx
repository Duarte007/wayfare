import { Link, Navigate, useParams } from '@tanstack/react-router';
import type { LucideIcon } from 'lucide-react';
import {
  CircleAlert,
  CircleCheck,
  Loader2,
  LogIn,
  MailOpen,
  MapPinned,
  RotateCw,
  WifiOff,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { IconTile } from '@/shared/ui/ui';
import { useInviteAcceptance } from '../application/useInviteAcceptance';

/** `/invite/<token>`: works signed out (sign in first) and signed in (joins, then opens the trip). */
export function InvitePage() {
  const { t } = useTranslation('group');
  const { t: tc } = useTranslation();
  const { token } = useParams({ strict: false }) as { token: string };
  const { state, retry } = useInviteAcceptance(token);

  switch (state.status) {
    case 'joined':
      return <Navigate to="/trips/$tripId" params={{ tripId: state.tripId }} replace />;
    case 'joining':
      return (
        <InviteScreen icon={MailOpen} title={t('joining')}>
          <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden />
        </InviteScreen>
      );
    case 'signedOut':
      return (
        <InviteScreen icon={MailOpen} title={t('invitedTitle')} body={t('invitedBody')}>
          <Button asChild size="lg">
            <Link to="/sign-in">
              <LogIn aria-hidden />
              {t('signInToJoin')}
            </Link>
          </Button>
        </InviteScreen>
      );
    case 'alreadyMember':
      return (
        <InviteScreen
          icon={CircleCheck}
          tone="sky"
          title={t('alreadyMemberTitle')}
          body={t('alreadyMemberBody')}
        >
          <Button asChild size="lg">
            <Link to="/trips/$tripId" params={{ tripId: state.tripId }} replace>
              <MapPinned aria-hidden />
              {t('openTrip')}
            </Link>
          </Button>
        </InviteScreen>
      );
    case 'offline':
      return (
        <InviteScreen icon={WifiOff} title={t('offlineTitle')} body={t('offlineBody')}>
          <Button size="lg" onClick={retry}>
            <RotateCw aria-hidden />
            {tc('retry')}
          </Button>
        </InviteScreen>
      );
    case 'invalid':
    case 'failed':
      return (
        <InviteScreen
          icon={CircleAlert}
          title={state.status === 'invalid' ? t('invalidTitle') : t('failedTitle')}
          body={state.status === 'invalid' ? t('invalidBody') : t('failedBody')}
        >
          {state.status === 'failed' ? (
            <Button size="lg" onClick={retry}>
              <RotateCw aria-hidden />
              {tc('retry')}
            </Button>
          ) : null}
          <Button asChild size="lg" variant={state.status === 'failed' ? 'outline' : 'default'}>
            <Link to="/" replace>
              {t('goToTrips')}
            </Link>
          </Button>
        </InviteScreen>
      );
  }
}

function InviteScreen({
  icon,
  tone,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  tone?: 'sky';
  title: string;
  body?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center px-4 py-16">
      <Card>
        <CardContent
          className="grid justify-items-center gap-4 py-4 text-center"
          aria-live="polite"
        >
          <IconTile icon={icon} size="lg" tone={tone} />
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          {body ? <p className="max-w-sm text-muted-foreground">{body}</p> : null}
          <div className="grid w-full gap-2">{children}</div>
        </CardContent>
      </Card>
    </main>
  );
}
