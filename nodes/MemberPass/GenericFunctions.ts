import type {
  IDataObject,
  IExecuteFunctions,
  IHookFunctions,
  ILoadOptionsFunctions,
  IHttpRequestMethods,
  IHttpRequestOptions,
  JsonObject,
  IWebhookFunctions,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';
import { randomUUID } from 'crypto';

type ApiContext =
  | IExecuteFunctions
  | IHookFunctions
  | ILoadOptionsFunctions
  | IWebhookFunctions;

/**
 * HTTP client wrapper that forwards auth + base URL from the configured
 * MemberPass credential and translates MemberPass's `{error: {code, message,
 * docs_url, remediation}}` envelope into an n8n NodeApiError the UI can
 * render with remediation guidance.
 */
export async function memberPassApiRequest(
  this: ApiContext,
  method: IHttpRequestMethods,
  path: string,
  body: IDataObject | undefined = undefined,
  qs: IDataObject | undefined = undefined,
  options: Partial<IHttpRequestOptions> = {},
): Promise<IDataObject> {
  const credentials = await this.getCredentials('memberPassApi');
  const baseUrl = ((credentials.baseUrl as string) || 'https://api.memberpass.net/v1').replace(
    /\/$/,
    '',
  );

  const requestOptions: IHttpRequestOptions = {
    method,
    url: `${baseUrl}${path}`,
    headers: {
      Accept: 'application/json',
      ...(options.headers ?? {}),
    },
    json: true,
    ...options,
  };

  if (body !== undefined && method !== 'GET') {
    requestOptions.body = body;
    requestOptions.headers = {
      'Content-Type': 'application/json',
      ...(requestOptions.headers ?? {}),
    };
  }

  if (qs !== undefined) {
    requestOptions.qs = qs;
  }

  if (shouldSendIdempotencyKey(method)) {
    requestOptions.headers = {
      'Idempotency-Key': randomUUID(),
      ...(requestOptions.headers ?? {}),
    };
  }

  try {
    return (await this.helpers.httpRequestWithAuthentication.call(
      this,
      'memberPassApi',
      requestOptions,
    )) as IDataObject;
  } catch (error) {
    throw new NodeApiError(this.getNode(), error as JsonObject, {
      message: extractErrorMessage(error as JsonObject),
      description: extractErrorRemediation(error as JsonObject),
    });
  }
}

/**
 * MemberPass requires an Idempotency-Key header on every mutation. n8n
 * generates one per request so retries from a user re-running a node do
 * not double-charge or double-create.
 */
function shouldSendIdempotencyKey(method: IHttpRequestMethods): boolean {
  return method === 'POST' || method === 'PATCH' || method === 'PUT' || method === 'DELETE';
}

function extractErrorMessage(error: JsonObject): string {
  const payload = (error?.response as JsonObject | undefined)?.body as JsonObject | undefined;
  const envelope = payload?.error as JsonObject | undefined;

  if (envelope?.message) {
    return String(envelope.message);
  }

  return (error?.message as string) || 'MemberPass request failed.';
}

function extractErrorRemediation(error: JsonObject): string | undefined {
  const payload = (error?.response as JsonObject | undefined)?.body as JsonObject | undefined;
  const envelope = payload?.error as JsonObject | undefined;

  const remediation = envelope?.remediation as string | undefined;
  const docsUrl = envelope?.docs_url as string | undefined;

  if (remediation && docsUrl) {
    return `${remediation} — see ${docsUrl}`;
  }

  return remediation ?? docsUrl;
}

/**
 * Iterate every page of a paginated MemberPass list endpoint and return
 * the concatenated `data` rows. Follows Laravel's `meta.current_page` /
 * `meta.last_page` pagination envelope and stops as soon as the cursor
 * reaches the last page or an empty page comes back. Defensively capped
 * at 100 pages so a runaway endpoint can never trap a worker.
 */
export async function memberPassApiRequestAllItems(
  this: ApiContext,
  method: IHttpRequestMethods,
  path: string,
  qs: IDataObject = {},
): Promise<IDataObject[]> {
  const all: IDataObject[] = [];
  const perPage = Math.min(Number(qs.per_page ?? 100), 100);
  let page = 1;
  const safetyCap = 100;

  while (page <= safetyCap) {
    const response = (await memberPassApiRequest.call(this, method, path, undefined, {
      ...qs,
      per_page: perPage,
      page,
    })) as IDataObject;

    const rows = (response.data as IDataObject[] | undefined) ?? [];
    all.push(...rows);

    const meta = response.meta as
      | { current_page?: number; last_page?: number }
      | undefined;

    if (rows.length === 0) {
      break;
    }

    if (!meta || typeof meta.last_page !== 'number') {
      break;
    }

    if ((meta.current_page ?? page) >= meta.last_page) {
      break;
    }

    page += 1;
  }

  return all;
}

/**
 * Build the payload map that MemberPass expects, dropping keys whose
 * value is explicitly `undefined` or an empty string. n8n assigns empty
 * strings to unfilled optional fields, which the API rejects.
 */
export function compactBody(body: IDataObject): IDataObject {
  const out: IDataObject = {};

  for (const [key, value] of Object.entries(body)) {
    if (value === undefined) {
      continue;
    }

    if (typeof value === 'string' && value.length === 0) {
      continue;
    }

    out[key] = value;
  }

  return out;
}
