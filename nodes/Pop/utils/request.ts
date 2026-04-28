/**
 * Shared HTTP helper for POP API requests
 *
 * All operation handlers call this function instead of making HTTP
 * requests directly. It provides:
 *
 * - Auto-injection of the `X-API-Key` header from the optional `popApi`
 *   credential. Callers that have already set the header (e.g. form-mode
 *   handlers using a per-operation licenseKey) take precedence.
 * - Base URL resolved from the caller-supplied value or the built-in default
 * - Rich error messages with URL, HTTP status, and response body excerpt
 *
 * The base URL can be set per-action via the "Base URL" input field on each
 * operation. When left at its default value the staging environment is used.
 */
import type { IExecuteFunctions, IHttpRequestOptions } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/** Re-export for convenience so operation files don't need to import from n8n-workflow */
export type PopRequestOptions = IHttpRequestOptions;

const BASE_URLS: Record<string, string> = {
	staging: 'https://staging7.popapi.io/wp-json/api/v2/',
	production: 'https://popapi.io/wp-json/api/v2/',
};

const DEFAULT_BASE_URL = BASE_URLS.staging;

/**
 * Reads the `popApi` credential's license key, if configured.
 * Returns `undefined` when no credential is attached to the node — this is
 * a normal state because the credential is optional and per-operation
 * licenseKey fields can supply the key inline.
 */
export async function getPopApiKey(
	execFns: IExecuteFunctions,
): Promise<string | undefined> {
	try {
		const cred = await execFns.getCredentials('popApi');
		const apiKey = (cred as { apiKey?: unknown } | undefined)?.apiKey;
		if (typeof apiKey === 'string' && apiKey.trim()) return apiKey.trim();
	} catch {
		// No credential configured — handlers fall back to per-operation licenseKey.
	}
	return undefined;
}

/**
 * Sends an HTTP request to the POP API and wraps errors with diagnostic info.
 *
 * @param options - Standard n8n HTTP request options (url, method, body, headers, etc.)
 * @param baseUrl - Optional base URL override. Falls back to the default staging URL.
 * @returns The parsed API response
 * @throws NodeOperationError with diagnostic details on failure
 */
export async function popRequest(
	this: IExecuteFunctions,
	options: PopRequestOptions,
	baseUrl?: string,
) {
	const resolvedBaseUrl = (baseUrl && BASE_URLS[baseUrl]) ? BASE_URLS[baseUrl] : DEFAULT_BASE_URL;

	// Inject X-API-Key from the credential when the caller hasn't already
	// supplied one. Header name comparison is case-insensitive because n8n
	// passes headers through HTTP layers that may normalize casing.
	const headersIn = (options.headers ?? {}) as Record<string, string>;
	const callerHasApiKey = Object.keys(headersIn).some(
		(k) => k.toLowerCase() === 'x-api-key',
	);
	if (!callerHasApiKey) {
		const credKey = await getPopApiKey(this);
		if (credKey) {
			options.headers = { ...headersIn, 'X-API-Key': credKey };
		}
	}

	const computeFinalUrl = (base: string, path: string | undefined) => {
		const baseTrim = base.endsWith('/') ? base : base + '/';
		const pathTrim = (path ?? '').replace(/^\//, '');
		return baseTrim + pathTrim;
	};

	const extractErrorDetails = (error: unknown) => {
		const out: { status?: number; data?: unknown } = {};
		if (typeof error === 'object' && error !== null) {
			const resp = (error as { response?: unknown }).response;
			if (typeof resp === 'object' && resp !== null) {
				const maybeStatus = (resp as { status?: unknown }).status;
				if (typeof maybeStatus === 'number') out.status = maybeStatus;
				out.data = (resp as { data?: unknown }).data;
			}
		}
		return out;
	};

	try {
		return await this.helpers.httpRequest({
			baseURL: resolvedBaseUrl,
			json: true,
			...options,
		});
	} catch (error) {
		const finalUrl = computeFinalUrl(resolvedBaseUrl, options.url);
		const method = (options.method || 'GET').toUpperCase();
		const { status, data } = extractErrorDetails(error);
		const detail = status ? ` status ${status}` : '';
		const bodySnippet = data ? ` response: ${JSON.stringify(data).slice(0, 500)}` : '';
		throw new NodeOperationError(
			this.getNode(),
			`POP request failed ${method} ${finalUrl}${detail}. ${(error as Error).message}${bodySnippet}`,
		);
	}
}
