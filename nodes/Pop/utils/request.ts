/**
 * Shared HTTP helper for POP API requests
 *
 * All operation handlers call this function instead of making HTTP
 * requests directly. It provides:
 *
 * - Unauthenticated requests via n8n's httpRequest helper
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

const DEFAULT_BASE_URL = 'https://staging7.popapi.io/wp-json/api/v2/';

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
	const resolvedBaseUrl =
		baseUrl && baseUrl.trim() ? baseUrl.trim() : DEFAULT_BASE_URL;

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
