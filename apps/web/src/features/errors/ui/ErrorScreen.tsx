import { Link, useRouter, type ErrorComponentProps } from '@tanstack/react-router';
import { Compass, Luggage, RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react';
import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/button';
import { Card, CardContent } from '@/shared/ui/card';
import { IconTile } from '@/shared/ui/ui';

function Notice({
  icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="grid justify-items-center gap-3 py-4 text-center">
        <IconTile icon={icon} size="lg" />
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="max-w-sm text-muted-foreground">{body}</p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>
      </CardContent>
    </Card>
  );
}

/** A screen crashed: say so calmly and offer a way out. Data is safe in the local store. */
export function ErrorScreen({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('app');
  return (
    <div role="alert">
      <Notice icon={TriangleAlert} title={t('errorTitle')} body={t('errorBody')}>
        <Button onClick={onRetry}>
          <RotateCcw aria-hidden />
          {t('tryAgain')}
        </Button>
        <Button asChild variant="outline">
          {/* A full page load: whatever broke starts from a clean slate. */}
          <a href="/">
            <Luggage aria-hidden />
            {t('goToTrips')}
          </a>
        </Button>
      </Notice>
    </div>
  );
}

/** TanStack Router's errorComponent: renders in place of the screen that threw. */
export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorScreen
      onRetry={() => {
        reset();
        void router.invalidate();
      }}
    />
  );
}

/** Unknown URL. Signed in it renders inside the app shell; signed out it points to sign-in. */
export function NotFoundScreen({ signedIn }: { signedIn: boolean }) {
  const { t } = useTranslation('app');
  return (
    <Notice icon={Compass} title={t('notFoundTitle')} body={t('notFoundBody')}>
      <Button asChild>
        {signedIn ? (
          <Link to="/">
            <Luggage aria-hidden />
            {t('goToTrips')}
          </Link>
        ) : (
          <Link to="/sign-in">{t('goToSignIn')}</Link>
        )}
      </Button>
    </Notice>
  );
}

/**
 * React error boundary around the shell's content, for anything the router's own boundary does
 * not catch. `resetKey` (the current path) clears the error when the person navigates away.
 */
export class ScreenErrorBoundary extends Component<
  { resetKey: string; children: ReactNode },
  { failed: boolean; resetKey: string }
> {
  override state = { failed: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { failed: boolean; resetKey: string },
  ) {
    return props.resetKey === state.resetKey ? null : { failed: false, resetKey: props.resetKey };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack);
  }

  override render() {
    if (this.state.failed) {
      return <ErrorScreen onRetry={() => this.setState({ failed: false })} />;
    }
    return this.props.children;
  }
}
