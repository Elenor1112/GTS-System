import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  getToken, resetEtaToken, submitDocuments, etaShareUrl, flattenEtaErrors, EtaError,
} from '@/lib/services/eta-client';

/**
 * The ETA client, against a stubbed fetch — these exercise the token
 * handling and response parsing, not the ETA itself.
 */

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const saved = { ...process.env };
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ETA_ENV = 'preprod';
  process.env.ETA_CLIENT_ID = 'client';
  process.env.ETA_CLIENT_SECRET = 'secret-1';
  process.env.ETA_CLIENT_SECRET_2 = 'secret-2';
  resetEtaToken();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...saved };
});

describe('token', () => {
  it('caches the token between calls', async () => {
    fetchMock.mockResolvedValueOnce(json(200, { access_token: 'tok', expires_in: 3600 }));
    expect(await getToken()).toBe('tok');
    expect(await getToken()).toBe('tok');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]![0]).toBe('https://id.preprod.eta.gov.eg/connect/token');
  });

  it('falls back to the second secret', async () => {
    fetchMock
      .mockResolvedValueOnce(json(400, { error: 'invalid_client' }))
      .mockResolvedValueOnce(json(200, { access_token: 'tok2', expires_in: 3600 }));
    expect(await getToken()).toBe('tok2');
    const body = fetchMock.mock.calls[1]![1].body as URLSearchParams;
    expect(body.get('client_secret')).toBe('secret-2');
    expect(body.get('scope')).toBe('InvoicingAPI');
  });

  it('reports when neither secret works', async () => {
    fetchMock.mockResolvedValue(json(400, { error: 'invalid_client' }));
    await expect(getToken()).rejects.toBeInstanceOf(EtaError);
  });

  it('refuses to run without credentials', async () => {
    delete process.env.ETA_CLIENT_ID;
    await expect(getToken()).rejects.toMatchObject({ code: 'ETA_NOT_CONFIGURED' });
  });
});

describe('submission', () => {
  it('retries once with a fresh token on 401, then parses the result', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 'old', expires_in: 3600 }))
      .mockResolvedValueOnce(new Response('', { status: 401 }))
      .mockResolvedValueOnce(json(200, { access_token: 'new', expires_in: 3600 }))
      .mockResolvedValueOnce(json(202, {
        submissionId: 'S1',
        acceptedDocuments: [{ uuid: 'U1', longId: 'L1', internalId: 'INV-1' }],
        rejectedDocuments: [],
      }));

    const result = await submitDocuments([{}]);
    expect(result.submissionId).toBe('S1');
    expect(result.acceptedDocuments[0]!.uuid).toBe('U1');
    const [url, init] = fetchMock.mock.calls[3]!;
    expect(url).toBe('https://api.preprod.invoicing.eta.gov.eg/api/v1/documentsubmissions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer new');
  });

  it('surfaces the ETA error body', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { access_token: 'tok', expires_in: 3600 }))
      .mockResolvedValueOnce(json(400, {
        error: { message: 'Bad', details: [{ target: 'issuer.id', message: 'Not registered' }] },
      }));
    await expect(submitDocuments([{}])).rejects.toThrow('issuer.id: Not registered');
  });
});

describe('helpers', () => {
  it('builds the public share URL', () => {
    expect(etaShareUrl('U1', 'L1')).toBe('https://preprod.invoicing.eta.gov.eg/documents/U1/share/L1');
    process.env.ETA_ENV = 'production';
    expect(etaShareUrl('U1', 'L1')).toBe('https://invoicing.eta.gov.eg/documents/U1/share/L1');
  });

  it('flattens a rejected document error', () => {
    expect(
      flattenEtaErrors({ message: 'Invalid', details: [{ message: 'Bad code', propertyPath: 'invoiceLines[0].itemCode' }] }),
    ).toEqual(['invoiceLines[0].itemCode: Bad code']);
  });
});
