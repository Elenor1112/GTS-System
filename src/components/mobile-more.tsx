'use client';

import { useState, useRef, useEffect } from 'react';

import { signOut } from '@/app/(auth)/actions';
import { Glyph } from './glyph';

/**
 * The mobile "More" sheet.
 *
 * The rail is hidden below the desktop breakpoint, so on a phone this is
 * the only way to reach anything outside the four primary destinations —
 * including sign-out, which the mobile bar has no room for otherwise.
 * Modelled on `UserMenu`'s disclosure: outside-click and Escape close it,
 * and it opens upward from a trigger pinned to the bottom of the screen.
 */

type MoreItem = { label: string; href: string; icon: string; active: boolean };
type MoreGroup = { label: string; items: MoreItem[] };
type MoreStrings = { account: string; signOut: string; more: string };

export function MobileMore({
  groups,
  nameEn,
  email,
  roleName,
  triggerActive,
  strings,
}: {
  groups: MoreGroup[];
  nameEn: string;
  email: string;
  roleName: string;
  triggerActive: boolean;
  strings: MoreStrings;
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
    <div ref={ref}>
      {open && <div className="gts-mobile-sheet-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}

      {open && (
        <div className="gts-mobile-sheet" role="menu" aria-label="More navigation">
          <div className="gts-mobile-sheet-identity">
            <span className="gts-user-avatar" aria-hidden="true">{initials}</span>
            <span className="gts-user-identity">
              <span className="gts-user-name" style={{ color: 'var(--gts-fg-primary)' }}>{nameEn}</span>
              <span className="gts-user-role" style={{ color: 'var(--gts-fg-muted)' }}>{roleName} · {email}</span>
            </span>
          </div>

          {groups.map((group, index) => (
            <div className="gts-mobile-sheet-group" key={`${index}-${group.label}`}>
              <p className="gts-mobile-sheet-group-label">{group.label}</p>
              {group.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="gts-mobile-sheet-item"
                  role="menuitem"
                  aria-current={item.active ? 'page' : undefined}
                >
                  <Glyph name={item.icon} />
                  {item.label}
                </a>
              ))}
            </div>
          ))}

          <div className="gts-mobile-sheet-group">
            <a href="/account" className="gts-mobile-sheet-item" role="menuitem">
              {strings.account}
            </a>
            <form action={signOut}>
              <button type="submit" className="gts-mobile-sheet-item" role="menuitem">
                {strings.signOut}
              </button>
            </form>
          </div>
        </div>
      )}

      <button
        type="button"
        className="gts-mobile-nav-item"
        aria-current={triggerActive ? 'page' : undefined}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <Glyph name="more" />
        {strings.more}
      </button>
    </div>
  );
}
