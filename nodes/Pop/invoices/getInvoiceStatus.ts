/**
 * Get Invoice Status
 *
 * Retrieves document notifications/status for a previously submitted
 * SdI invoice via the POP API `document-notifications` endpoint.
 *
 * Request payload: { license_key, integration: { uuid } }
 * The UUID is obtained from the response of a prior create-xml call.
 *
 * Supports passthrough, form, JSON, and raw input modes.
 *
 * POP API endpoint: POST /document-notifications
 */
import type { IExecuteFunctions, INodePropertyOptions } from 'n8n-workflow';
import { InvoicesProperties } from '../types/pop';
import { popRequest, type PopRequestOptions } from '../utils/request';

/** Operation metadata shown in the n8n operation selector dropdown */
export const options: INodePropertyOptions = {
	name: 'Get Invoice Status',
	value: 'getInvoiceStatus',
	description: 'Fetch document notifications/status for an invoice integration UUID',
	action: 'Get invoice status',
};

const OPERATION = 'getInvoiceStatus';

/**
 * Node properties (UI fields) for this operation.
 * Simpler than the create operations — only needs UUID and license key.
 */
export const properties: InvoicesProperties = [
	{
		displayName: 'Environment',
		name: 'baseUrl',
		type: 'options',
		options: [
			{ name: 'Staging', value: 'staging' },
			{ name: 'Production', value: 'production' },
		],
		default: 'staging',
		displayOptions: { show: { resource: ['invoices'], operation: [OPERATION] } },
		description: 'The POP API environment to use',
	},
	{
		displayName: 'Endpoint Path',
		name: 'path',
		type: 'string',
		default: 'document-notifications',
		displayOptions: { show: { resource: ['invoices'], operation: [OPERATION] } },
		description: 'Relative path of the POP endpoint for document notifications',
	},
	{
		displayName: 'Input Mode',
		name: 'inputMode',
		type: 'options',
		noDataExpression: true,
		options: [
			{ name: 'Use Incoming JSON', value: 'passthrough' },
			{ name: 'Form Fields', value: 'form' },
			{ name: 'JSON', value: 'json' },
			{ name: 'Raw (XML/Other)', value: 'raw' },
		],
		default: 'passthrough',
		displayOptions: { show: { resource: ['invoices'], operation: [OPERATION] } },
		description:
			'Use Incoming JSON forwards the input item as-is (ideal for webhooks). Form Fields lets you fill in each field. JSON and Raw allow manual payloads.',
	},
	// ── Form fields (visible when inputMode = form) ──
	{
		displayName: 'Integration UUID',
		name: 'integrationUuid',
		type: 'string',
		required: true,
		default: '',
		displayOptions: {
			show: { resource: ['invoices'], operation: [OPERATION], inputMode: ['form'] },
		},
		description: 'UUID of the integration whose status should be retrieved',
	},
	{
		displayName: 'License Key',
		name: 'licenseKey',
		type: 'string',
		default: '',
		typeOptions: { password: true },
		displayOptions: {
			show: { resource: ['invoices'], operation: [OPERATION], inputMode: ['form'] },
		},
		description:
			'POP license key. Sent as the X-API-Key header and as license_key in the body for backwards compatibility. Leave empty to use the configured POP API credential.',
	},
	// ── JSON body (visible when inputMode = json) ──
	{
		displayName: 'JSON Body',
		name: 'jsonBody',
		type: 'json',
		default:
			'{\n  "license_key": "your_license_key",\n  "integration": {\n    "uuid": "your_uuid"\n  }\n}',
		displayOptions: {
			show: { resource: ['invoices'], operation: [OPERATION], inputMode: ['json'] },
		},
		description:
			'Complete request body as JSON. Must follow the POP API v2 document-notifications schema.',
	},
	// ── Raw body (visible when inputMode = raw) ──
	{
		displayName: 'Raw Body',
		name: 'rawBody',
		type: 'string',
		default: '',
		typeOptions: { rows: 8 },
		displayOptions: {
			show: { resource: ['invoices'], operation: [OPERATION], inputMode: ['raw'] },
		},
		description: 'Raw request payload if the endpoint expects a non-JSON format',
	},
	{
		displayName: 'Extra Headers (JSON)',
		name: 'headers',
		type: 'json',
		default: '{}',
		displayOptions: { show: { resource: ['invoices'], operation: [OPERATION] } },
		description:
			'Optional additional headers as JSON object. Example: {"Content-Type":"application/xml"}.',
	},
];

/**
 * Operation handler — builds and sends the document-notifications request.
 *
 * Form mode builds a simple payload with license_key and integration.uuid.
 * Other modes work identically to the create operations.
 */
export async function handler(
	this: IExecuteFunctions,
	params: {
		baseUrl?: string;
		path: string;
		inputMode: 'form' | 'json' | 'raw' | 'passthrough';
		integrationUuid?: string;
		licenseKey?: string;
		jsonBody?: object;
		rawBody?: string;
		headers?: Record<string, string>;
		_itemIndex?: number;
	},
): Promise<unknown> {
	const { baseUrl, path, inputMode, headers } = params;

	const requestOptions: PopRequestOptions = {
		url: path,
		method: 'POST',
		headers: {
			...(headers ?? {}),
		},
	};

	if (inputMode === 'passthrough') {
		requestOptions.json = true;
		const itemIndex = params._itemIndex ?? 0;
		requestOptions.body = this.getInputData()[itemIndex].json;
	} else if (inputMode === 'form') {
		// Build the simple status query payload.
		// Per-operation licenseKey, when present, overrides the credential and is
		// sent both as X-API-Key (preferred) and as license_key in the body.
		requestOptions.json = true;
		const formKey = (params.licenseKey ?? '').trim();
		if (formKey) {
			requestOptions.headers = { ...(requestOptions.headers ?? {}), 'X-API-Key': formKey };
		}
		requestOptions.body = {
			license_key: params.licenseKey,
			integration: { uuid: params.integrationUuid },
		};
	} else if (inputMode === 'json') {
		requestOptions.json = true;
		requestOptions.body = params.jsonBody ?? {};
	} else {
		requestOptions.json = false;
		requestOptions.body = params.rawBody ?? '';
		requestOptions.headers = {
			'Content-Type': requestOptions.headers?.['Content-Type'] ?? 'application/xml',
			...(requestOptions.headers ?? {}),
		};
	}

	return await popRequest.call(this, requestOptions, baseUrl);
}
