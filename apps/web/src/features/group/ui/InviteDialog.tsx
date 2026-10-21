import {
  CircleAlert,
  CircleCheck,
  Copy,
  Link2,
  Loader2,
  Share2,
  UserPlus,
  WifiOff,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/shared/lib/online';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { Label } from '@/shared/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { useInviteLink, type ShareOutcome } from '../application/useInviteLink';
import { INVITE_DAYS, INVITE_MAX_USES, INVITE_ROLES, type InviteRole } from '../domain/group';
import type { InviteFailure } from '../domain/group-ports';

const ROLE_LABELS = { editor: 'inviteAsEditor', viewer: 'inviteAsViewer' } as const;
const ERROR_KEYS: Record<InviteFailure, 'inviteOffline' | 'inviteDenied' | 'inviteFailed'> = {
  offline: 'inviteOffline',
  denied: 'inviteDenied',
  invalid: 'inviteFailed',
  failed: 'inviteFailed',
};

/** Owner or editor makes a link for a role, then shares it from the phone or copies it. */
export function InviteDialog({ trip }: { trip: { id: string; name: string } }) {
  const { t } = useTranslation('group');
  const { t: tc } = useTranslation();
  const online = useOnline();
  const invite = useInviteLink(trip.id, t('shareText', { name: trip.name }));
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const ids = { role: useId(), link: useId() };

  const after = (result: ShareOutcome) => setOutcome(result === 'cancelled' ? null : result);

  return (
    <Dialog
      onOpenChange={(open) => {
        if (open) {
          invite.reset();
          setOutcome(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus aria-hidden />
          {t('invite')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('inviteTitle', { name: trip.name })}</DialogTitle>
          <DialogDescription>
            {t('inviteBody', { days: INVITE_DAYS, max: INVITE_MAX_USES })}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="grid gap-2">
            <Label id={ids.role}>{t('inviteRole')}</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              aria-labelledby={ids.role}
              value={invite.role}
              // Radix sends '' when the active item is pressed again; keep a role selected.
              onValueChange={(value) => {
                if (!value) return;
                invite.setRole(value as InviteRole);
                setOutcome(null);
              }}
              className="grid w-full grid-cols-2"
            >
              {INVITE_ROLES.map((role) => (
                <ToggleGroupItem key={role} value={role}>
                  {t(ROLE_LABELS[role])}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {!online ? (
            <Alert variant="info" role="status">
              <WifiOff aria-hidden />
              <AlertDescription>{t('inviteOffline')}</AlertDescription>
            </Alert>
          ) : null}
          {invite.error && online ? (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden />
              <AlertDescription>{t(ERROR_KEYS[invite.error])}</AlertDescription>
            </Alert>
          ) : null}

          {invite.link ? (
            <div className="grid gap-3">
              <div className="grid gap-2">
                <Label htmlFor={ids.link}>{t('inviteLink')}</Label>
                <Input
                  id={ids.link}
                  readOnly
                  value={invite.link}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {invite.canShare ? (
                  <Button onClick={() => void invite.share().then(after)}>
                    <Share2 aria-hidden />
                    {t('share')}
                  </Button>
                ) : null}
                <Button
                  variant={invite.canShare ? 'outline' : 'default'}
                  onClick={() => void invite.copy().then(after)}
                >
                  <Copy aria-hidden />
                  {t('copy')}
                </Button>
              </div>
              <p role="status" className="min-h-5 text-sm">
                {outcome === 'copied' ? (
                  <span className="inline-flex items-center gap-1.5 font-medium text-success">
                    <CircleCheck className="size-4" aria-hidden />
                    {t('copied')}
                  </span>
                ) : outcome === 'copyFailed' ? (
                  <span className="font-medium text-destructive">{t('copyFailed')}</span>
                ) : null}
              </p>
            </div>
          ) : (
            <Button disabled={!online || invite.creating} onClick={() => void invite.create()}>
              {invite.creating ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Link2 aria-hidden />
              )}
              {invite.creating ? t('creatingLink') : t('createLink')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
