import { useState } from 'react';
import { initials } from '../lib/initials';

/** Photo from the identity provider when it loads (it won't offline), otherwise initials. */
export function Avatar({
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
  const [failed, setFailed] = useState(false);
  const sizes = { sm: 'size-9 text-sm', md: 'size-11 text-base', lg: 'size-20 text-2xl' };
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft font-bold text-accent ${sizes[size]}`}
    >
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials(name, email)
      )}
    </span>
  );
}
