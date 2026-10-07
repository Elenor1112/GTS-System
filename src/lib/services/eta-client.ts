import 'server-only';

import { DomainError } from '../errors';

/**
 * GTS — the Egyptian Tax Authority API client.
 *
 * Transport only: OAuth token, authenticated fetch, and the three
 * endpoints GTS uses. It knows nothing about bills — eta-document.ts
 * builds the payload, eta-submission.ts decides when to send it.
 *
 * Credentials come from the environment, never the database: they are
 * deployment secrets, not business settings an administrator edits. The
 * ETA issues two client secrets so one can be rotated while the other
 * keeps working, and either is accepted here.
 */

export class EtaError extends DomainError {}

export type EtaEnvironment = 'preprod' | 'production';

const ENDPOINTS: Record<EtaEnvironment, { identity: string; api: string; portal: string }> = {
  preprod: {
    identity: 'https://id.preprod.eta.gov.eg/connect/token',
    api: 'https://api.preprod.invoicing.eta.gov.eg/api/v1',
    portal: 'https://preprod.invoicing.eta.gov.eg',
  },
  production: {
    identity: 'https://id.eta.gov.eg/connect/token',
    api: 'https://api.invoicing.eta.gov.eg/api/v1',
    portal: 'https://invoicing.eta.gov.eg',
  },
};

export interface EtaConfig {
  environment: EtaEnvironment;
  clientId: string;
  secrets: string[];
  identity: string;
  api: string;
  portal: string;
}

/** The environment the ETA_ENV variable names; preprod unless told otherwise. */
export function etaEnvironment(): EtaEnvironment {
  return process.env.ETA_ENV === 'production' ? 'production' : 'preprod';
}

/** Whether credentials are present — for a status line, not a guarantee they work. */
export function etaConfigured(): boolean {
  return Boolean(process.env.ETA_CLIENT_ID && (process.env.ETA_CLIENT_SECRET || process.env.ETA_CLIENT_SECRET_2));
}

export function etaConfig(): EtaConfig {
  const environment = etaEnvironment();
  const clientId = process.env.ETA_CLIENT_ID ?? '';
  const secrets = [process.env.ETA_CLIENT_SECRET, process.env.ETA_CLIENT_SECRET_2].filter(
    (s): s is string => Boolean(s),
  );
  if (!clientId || secrets.length === 0) {
    throw new EtaError(
      'ETA_NOT_CONFIGURED',
      'The ETA connection is not configured. Set ETA_CLIENT_ID and ETA_CLIENT_SECRET in the environment.',
    );
  }
  return { environment, clientId, secrets, ...ENDPOINTS[environment] };
}

/** The ETA portal for the configured environment — where codes are registered. */
export function etaPortalUrl(): string {
  return ENDPOINTS[etaEnvironment()].portal;
}

/** The public ETA page for a document — what the printed QR code opens. */
export function etaShareUrl(uuid: string, longId: string | null): string {
  const { portal } = ENDPOINTS[etaEnvironment()];
  return longId ? `${portal}/documents/${uuid}/share/${longId}` : `${portal}/documents/${uuid}`;
}

/* ============================================================
   TOKEN
   ============================================================ */

let cachedToken: { value: string; expiresAt: number } | null = null;

/** For tests: forget the cached token. */
export function resetEtaToken(): void {
  cachedToken = null;
}

/**
 * An access token, cached until a minute before it expires.
 *
 * Tries each secret in turn: a rotated-out secret answers
 * `invalid_client`, and the second one is exactly what it exists for.
 */
export async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const config = etaConfig();
  let lastError = '';

  for (const secret of config.secrets) {
    const response = await fetch(config.identity, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.clientId,
        client_secret: secret,
        scope: 'InvoicingAPI',
      }),
      cache: 'no-store',
    });

    const body = (await response.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };

    if (response.ok && body.access_token) {
      cachedToken = {
        value: body.access_token,
        expiresAt: Date.now() + Math.max(0, (body.expires_in ?? 3600) - 60) * 1000,
      };
      return body.access_token;
    }
    lastError = body.error ?? `HTTP ${response.status}`;
  }

  throw new EtaError(
    'ETA_AUTH_FAILED',
    `The ETA refused the client credentials (${lastError}). Check ETA_CLIENT_ID and the secrets, and that they belong to ${config.environment}.`,
  );
}

/* ============================================================
   REQUESTS
   ============================================================ */

/**
 * An authenticated request to the ETA API.
 *
 * A 401 means the cached token was revoked or expired early, so it is
 * dropped and the request retried once. Any other failure becomes an
 * EtaError carrying the ETA's own error body, verbatim.
 */
export async function etaFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { api } = etaConfig();

  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await getToken();
    const response = await fetch(`${api}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (response.status === 401 && attempt === 0) {
      cachedToken = null;
      continue;
    }

    const text = await response.text();
    const body = text ? safeJson(text) : null;

    if (!response.ok) {
      throw new EtaError('ETA_API_ERROR', etaErrorMessage(body, response.status), {
        status: response.status,
        body,
      });
    }
    return body as T;
  }

  throw new EtaError('ETA_AUTH_FAILED', 'The ETA rejected the access token twice.');
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** The ETA nests its messages as `error.details[].message`; flatten them. */
export function etaErrorMessage(body: unknown, status: number): string {
  const messages = flattenEtaErrors(body);
  return messages.length
    ? `The ETA returned an error: ${messages.join(' · ')}`
    : `The ETA returned HTTP ${status}.`;
}

export function flattenEtaErrors(body: unknown): string[] {
  if (!body || typeof body !== 'object') return typeof body === 'string' && body ? [body] : [];
  const node = body as Record<string, unknown>;
  const out: string[] = [];

  const inner = (node.error ?? node) as Record<string, unknown> | string;
  if (typeof inner === 'string') return [inner];

  const details = Array.isArray(inner.details) ? inner.details : [];
  for (const detail of details as Record<string, unknown>[]) {
    const text = String(detail.message ?? detail.error ?? '');
    const target = detail.target || detail.propertyPath;
    if (text) out.push(target ? `${String(target)}: ${text}` : text);
  }
  if (out.length === 0 && inner.message) out.push(String(inner.message));
  return out;
}

/* ============================================================
   ENDPOINTS
   ============================================================ */

export interface SubmissionResponse {
  submissionId: string | null;
  acceptedDocuments: { uuid: string; longId: string; internalId: string }[];
  rejectedDocuments: { internalId: string; error: unknown }[];
}

export async function submitDocuments(documents: unknown[]): Promise<SubmissionResponse> {
  const body = await etaFetch<Partial<SubmissionResponse>>('/documentsubmissions', {
    method: 'POST',
    body: JSON.stringify({ documents }),
  });
  return {
    submissionId: body?.submissionId ?? null,
    acceptedDocuments: body?.acceptedDocuments ?? [],
    rejectedDocuments: body?.rejectedDocuments ?? [],
  };
}

export interface DocumentDetails {
  uuid: string;
  longId?: string;
  status: string;
  validationResults?: {
    status?: string;
    validationSteps?: { name?: string; status?: string; error?: unknown }[];
  };
}

export async function getDocumentDetails(uuid: string): Promise<DocumentDetails> {
  return etaFetch<DocumentDetails>(`/documents/${encodeURIComponent(uuid)}/details`);
}

export async function cancelDocument(uuid: string, reason: string): Promise<void> {
  await etaFetch(`/documents/state/${encodeURIComponent(uuid)}/state`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled', reason }),
  });
}

/** One row of the taxpayer's code-usage requests, as the ETA returns it. */
export interface CodeUsageRow {
  codeTypeName?: string;
  itemCode?: string;
  codeNamePrimaryLang?: string;
  codeNameSecondaryLang?: string;
  parentItemCode?: string;
  status?: string;
  active?: boolean;
}

/**
 * The item codes this taxpayer may put on a document: its approved,
 * active EGS and GS1 code-usage requests. Paged by the ETA; all pages
 * are read.
 */
export async function listMyApprovedCodes(): Promise<CodeUsageRow[]> {
  const rows: CodeUsageRow[] = [];
  const pageSize = 100;

  for (let page = 1; page <= 50; page++) {
    const body = await etaFetch<{ result?: CodeUsageRow[]; metadata?: { totalPages?: number } }>(
      `/codetypes/requests/my?Active=true&Status=Approved&PageSize=${pageSize}&PageNumber=${page}`,
    );
    rows.push(...(body?.result ?? []));
    if (page >= (body?.metadata?.totalPages ?? 0)) break;
  }

  // The query filters already; this holds if the ETA ever ignores them.
  return rows.filter(
    (r) => r.itemCode && r.active !== false && (!r.status || r.status.toLowerCase() === 'approved'),
  );
}
