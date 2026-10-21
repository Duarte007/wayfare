import { initials } from '../lib/initials';
import { cn } from '@/shared/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from './avatar';

/** The signed-in person: provider photo when it loads (it won't offline), otherwise initials. */
export function UserAvatar({
  name,
  email,
  imageUrl,
  size = 'md',
}: {
  name: string | null;
  email: string | null;
  imageUrl: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizes = { sm: 'size-9 text-sm', md: 'size-11 text-base', lg: 'size-20 text-2xl' };
  return (
    <Avatar aria-hidden="true" className={cn(sizes[size])}>
      {imageUrl ? <AvatarImage src={imageUrl} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback>{initials(name, email)}</AvatarFallback>
    </Avatar>
  );
}
