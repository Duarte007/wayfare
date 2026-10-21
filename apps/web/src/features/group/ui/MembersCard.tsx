import { useNavigate } from '@tanstack/react-router';
import { CircleAlert, LogOut, UserMinus, Users, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '@/shared/lib/online';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/shared/ui/alert-dialog';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/ui/card';
import { UserAvatar } from '@/shared/ui/UserAvatar';
import type { TripMember } from '../../members/domain/members';
import { useGroupMembers } from '../application/useGroupMembers';
import { canInvite, canLeave, canRemove } from '../domain/group';
import { InviteDialog } from './InviteDialog';

const DESTRUCTIVE = 'bg-destructive text-white hover:bg-destructive/90';

/** Who is on the trip, with roles; invite, remove (owner) or leave (everyone else). */
export function MembersCard({ trip }: { trip: { id: string; name: string; owner_id: string } }) {
  const { t } = useTranslation('group');
  const { t: tc } = useTranslation();
  const online = useOnline();
  const navigate = useNavigate();
  const group = useGroupMembers(trip);
  const { members, userId, myRole } = group;

  const nameOf = (m: TripMember) => {
    const name = m.name ?? t('unnamed');
    return m.userId === userId ? (m.name ? t('youNamed', { name }) : t('you')) : name;
  };
  const viewer = userId && myRole ? { userId, role: myRole } : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="inline-flex items-center gap-2">
            <Users className="size-5 text-primary" aria-hidden />
            {t('membersTitle')}
          </h2>
        </CardTitle>
        {members.length > 0 ? (
          <CardDescription>{t('membersCount', { count: members.length })}</CardDescription>
        ) : null}
        {canInvite(myRole) ? (
          <CardAction>
            <InviteDialog trip={trip} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {!online ? (
          <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
            <WifiOff className="size-4 shrink-0" aria-hidden />
            {members.length > 0 ? t('membersOffline') : t('membersEmpty')}
          </p>
        ) : null}
        {group.problem ? (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden />
            <AlertDescription>
              {group.problem === 'offline' ? t('changeOffline') : t('changeFailed')}
            </AlertDescription>
          </Alert>
        ) : null}
        {members.length > 0 ? (
          <ul className="grid gap-1">
            {members.map((m) => (
              <li key={m.userId} className="flex min-w-0 items-center gap-3 py-1">
                <UserAvatar name={m.name} email={null} imageUrl={null} size="sm" />
                <span className="min-w-0 flex-1 truncate font-medium">{nameOf(m)}</span>
                <Badge variant={m.role === 'owner' ? 'soft' : 'secondary'}>
                  {t(`role_${m.role}`)}
                </Badge>
                {viewer && canRemove(viewer, m) ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="-mr-2 shrink-0 text-muted-foreground hover:text-destructive"
                        aria-label={t('removeNamed', { name: m.name ?? t('unnamed') })}
                        disabled={!online || group.busy}
                      >
                        <UserMinus aria-hidden />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {t('removeTitle', { name: m.name ?? t('unnamed') })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>{t('removeBody')}</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                        <AlertDialogAction
                          className={DESTRUCTIVE}
                          onClick={() => void group.remove(m.userId)}
                        >
                          <UserMinus aria-hidden />
                          {t('remove')}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {canLeave(myRole) ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="-ml-2 w-fit text-destructive"
                disabled={!online || group.busy}
              >
                <LogOut aria-hidden />
                {t('leave')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('leaveTitle', { name: trip.name })}</AlertDialogTitle>
                <AlertDialogDescription>{t('leaveBody')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  className={DESTRUCTIVE}
                  onClick={() =>
                    void group.leave().then(async (left) => {
                      if (left) await navigate({ to: '/', replace: true });
                    })
                  }
                >
                  <LogOut aria-hidden />
                  {t('leave')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </CardContent>
    </Card>
  );
}
