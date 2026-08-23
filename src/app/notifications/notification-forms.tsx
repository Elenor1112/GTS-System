'use client';

import type { ReactNode } from 'react';
import { useActionState, useTransition } from 'react';

import { Submit } from '@/components/form';

import { submitMarkAllRead, submitMarkRead } from './actions';

/** Clear the whole list. */
export function MarkAllRead({ dict }: { dict: { markAllRead: string; marking: string } }) {
  const [, formAction] = useActionState(submitMarkAllRead, null);

  return (
    <form action={formAction}>
      <Submit variant="secondary" pendingLabel={dict.marking}>
        {dict.markAllRead}
      </Submit>
    </form>
  );
}

/**
 * A notification's link.
 *
 * Marks it read on the way, then follows the link. Doing both means the
 * badge count reflects what the person has actually seen rather than
 * what they remembered to dismiss.
 */
export function NotificationLink({
  id,
  href,
  children,
}: {
  id: string;
  href: string;
  children: ReactNode;
}) {
  const [, startTransition] = useTransition();

  return (
    <a
      href={href}
      className="gts-cell-link"
      onClick={() => {
        // Fire and forget: the navigation must not wait on it, and a
        // failed mark-as-read is not worth blocking the click.
        const data = new FormData();
        data.set('notificationId', id);
        startTransition(() => {
          void submitMarkRead(null, data);
        });
      }}
    >
      {children}
    </a>
  );
}
