'use client';

import { useState, useRef, useEffect } from 'react';

import { signOut } from '@/app/(auth)/actions';
import { setTheme, setLocale } from '@/app/preferences-actions';
import type { Theme, Locale } from '@/lib/preferences';
import type { Dictionary } from '@/lib/i18n';

/**
 * The identity block at the foot of the rail.
 *
 * Who you are signed in as, and how to stop being signed in as them —
 * plus the two display preferences, theme and language, which live here
 * rather than in Administration because they are personal to the person
 * looking at the screen, not a setting for the organisation.
 */
type UserMenuDict = {
  preferences: Dictionary['preferences'];
  nav: Pick<Dictionary['nav'], 'account' | 'signOut'>;
};

export function UserMenu({
  nameEn,
  email,
  roleName,
  theme,
  locale,
  dict,
}: {
  nameEn: string;
  email: string;
  roleName: string;
  theme: Theme;
  locale: Locale;
  dict: UserMenuDict;
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
          <div className="gts-pref-group">
            <p className="gts-pref-label">{dict.preferences.appearance}</p>
            <form action={setTheme} className="gts-pref-segment">
              <ThemeButton value="light" current={theme}>{dict.preferences.light}</ThemeButton>
              <ThemeButton value="dark" current={theme}>{dict.preferences.dark}</ThemeButton>
              <ThemeButton value="system" current={theme}>{dict.preferences.system}</ThemeButton>
            </form>
          </div>

          <div className="gts-pref-group">
            <p className="gts-pref-label">{dict.preferences.language}</p>
            <form action={setLocale} className="gts-pref-segment">
              <LocaleButton value="en" current={locale}>{dict.preferences.english}</LocaleButton>
              <LocaleButton value="ar" current={locale}>{dict.preferences.arabic}</LocaleButton>
            </form>
          </div>

          <a href="/account" className="gts-user-sheet-item" role="menuitem">
            {dict.nav.account}
          </a>
          <form action={signOut}>
            <button type="submit" className="gts-user-sheet-item" role="menuitem">
              {dict.nav.signOut}
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

function ThemeButton({
  value,
  current,
  children,
}: {
  value: Theme;
  current: Theme;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="submit"
      name="theme"
      value={value}
      className={`gts-pref-option${active ? ' gts-pref-option-active' : ''}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function LocaleButton({
  value,
  current,
  children,
}: {
  value: Locale;
  current: Locale;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="submit"
      name="locale"
      value={value}
      className={`gts-pref-option${active ? ' gts-pref-option-active' : ''}`}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}
