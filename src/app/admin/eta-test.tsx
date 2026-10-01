'use client';

import { useActionState } from 'react';

import { FormError, Submit } from '@/components/form';
import type { Dictionary } from '@/lib/i18n';

import { submitEtaTest } from './actions';

type EtaDict = Dictionary['admin']['settings']['eta'];

/** One button: ask the ETA for a token and report what it said. */
export function EtaTest({ dict }: { dict: EtaDict }) {
  const [state, formAction] = useActionState(submitEtaTest, null);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <FormError state={state} />
      {state?.ok && (
        <p className="gts-form-success" role="status">
          {dict.testOk}
        </p>
      )}
      <Submit variant="secondary" pendingLabel={dict.testing}>
        {dict.testButton}
      </Submit>
    </form>
  );
}
