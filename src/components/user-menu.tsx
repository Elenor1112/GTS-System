'use client';

import { useState, useRef, useEffect } from 'react';

import { signOut } from '@/app/(auth)/actions';

/**
 * The identity block at the foot of the rail.
 *
 * Who you are signed in as, and how to stop being signed in as them.
 * A client component only because the disclosure needs state — the
 * sign-out itself is a server action.
 */
export function UserMenu({
  nameEn,
  email,
  roleName,
}: {
  nameEn: string;
  email: string;
  roleName: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const initials = nameEn
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <div className="gts-rail-foot" ref={ref}>
      {open && (
        <div className="gts-user-sheet" role="menu">
          <a href="/account" className="gts-user-sheet-item" role="menuitem">
            Your account
          </a>
          <form action={signOut}>
            <button type="submit" className="gts-user-sheet-item" role="menuitem">
              Sign out
            </button>
          </form>
        </div>
      )}

      <button
        type="button"
        className="gts-user-button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span className="gts-user-avatar" aria-hidden="true">{initials}</span>
        <span className="gts-user-identity">
          <span className="gts-user-name">{nameEn}</span>
          <span className="gts-user-role">{roleName}</span>
        </span>
      </button>
    </div>
  );
}
