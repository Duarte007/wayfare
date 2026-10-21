import { CHECKLIST_GROUPS, type ChecklistGroup, type ChecklistItem } from '@wayfare/shared';
import { ListTodo, Trash2 } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Button } from '@/shared/ui/button';
import { DateField } from '@/shared/ui/DateField';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/dialog';
import { Label } from '@/shared/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select';
import { Switch } from '@/shared/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/shared/ui/toggle-group';
import { Field } from '@/shared/ui/ui';
import type { TripMember } from '../../members/domain/members';
import { useChecklistItemForm } from '../application/useChecklistItemForm';
import { CHECKLIST_TITLE_MAX } from '../domain/checklist';

/** Add a to-do (no `existing`) or edit/remove one; `trigger` opens it. */
export function ChecklistItemDialog({
  tripId,
  items,
  group,
  members,
  currentUserId,
  existing,
  trigger,
}: {
  tripId: string;
  items: readonly ChecklistItem[];
  /** Section a new item starts in. */
  group?: ChecklistGroup;
  /** Trip members; the "who" picker shows when there is more than one. */
  members: TripMember[];
  currentUserId: string | undefined;
  existing?: ChecklistItem;
  trigger: ReactNode;
}) {
  const { t } = useTranslation('checklist');
  const { t: tc } = useTranslation();
  const [open, setOpen] = useState(false);
  const form = useChecklistItemForm({ tripId, items, group }, existing);
  const ids = { section: useId(), shared: useId(), who: useId() };
  const { input, update, errors } = form;

  const memberName = (m: TripMember) =>
    m.userId === currentUserId ? t('you') : (m.name ?? t('unnamedMember'));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (await form.save()) setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) form.reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{existing ? t('editItem') : t('addItem')}</DialogTitle>
          <DialogDescription>{t('itemHint')}</DialogDescription>
        </DialogHeader>
        <form noValidate onSubmit={(e) => void onSubmit(e)} className="grid gap-5">
          <Field
            label={t('itemTitle')}
            icon={ListTodo}
            placeholder={t('itemTitlePlaceholder')}
            value={input.title}
            onChange={(e) => update({ title: e.target.value })}
            error={errors.includes('title_required') ? t('errorTitle') : undefined}
            maxLength={CHECKLIST_TITLE_MAX}
            autoComplete="off"
            autoFocus={!existing}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={ids.section}>{t('section')}</Label>
              <Select
                value={input.group}
                onValueChange={(value) => update({ group: value as ChecklistGroup })}
              >
                <SelectTrigger id={ids.section} className="w-full text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHECKLIST_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {t(`groups.${g}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateField
              label={t('dueDate')}
              placeholder={t('noDueDate')}
              value={input.dueDate}
              clearLabel={t('clearDueDate')}
              onChange={(dueDate) => update({ dueDate })}
            />
          </div>
          <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
            <div className="grid gap-0.5">
              <Label htmlFor={ids.shared}>{t('shareWithGroup')}</Label>
              <p className="text-sm text-muted-foreground">
                {input.shared ? t('sharedHint') : t('privateHint')}
              </p>
            </div>
            <Switch
              id={ids.shared}
              checked={input.shared}
              onCheckedChange={(shared) => update({ shared })}
            />
          </div>
          {input.shared && members.length > 1 ? (
            <div className="grid gap-2">
              <Label id={ids.who}>{t('forWhom')}</Label>
              <ToggleGroup
                type="multiple"
                variant="outline"
                aria-labelledby={ids.who}
                value={input.assignees}
                onValueChange={(assignees) => update({ assignees })}
                className="flex w-full flex-wrap justify-start"
              >
                {members.map((m) => (
                  <ToggleGroupItem key={m.userId} value={m.userId} className="px-4">
                    {memberName(m)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <p className="text-sm text-muted-foreground">{t('forWhomHint')}</p>
            </div>
          ) : null}
          <DialogFooter className="sm:justify-between">
            {existing ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-destructive">
                    <Trash2 aria-hidden />
                    {t('removeItem')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {t('removeTitle', { name: existing.title })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t('removeBody')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{tc('cancel')}</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-white hover:bg-destructive/90"
                      onClick={() => void form.remove().then(() => setOpen(false))}
                    >
                      {t('remove')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}
            <Button type="submit" size="lg" disabled={form.saving}>
              {existing ? tc('save') : t('addItem')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
