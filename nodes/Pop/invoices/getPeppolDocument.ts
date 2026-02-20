/**
 * Get Peppol Document
 *
 * Retrieves a Peppol document by integration UUID via the POP API
 * `peppol/document-get` endpoint.
 *
 * Request payload: { license_key, integration: { uuid, zone? } }
 * The zone field (e.g. "BE") is required for Belgian VAT numbers
 * and indicates which Peppol access point zone to query.
 *
 * Supports passthrough, form, JSON, and raw input modes.
 *
 * POP API endpoint: POST /peppol/document-get
 */
import type { IExecuteFunctions, INodePropertyOptions } from 'n8n-workflow';
import { InvoicesProperties } from '../types/pop';
import { popRequest, type PopRequestOptions } from '../utils/request';

/** Operation metadata shown in the n8n operation selector dropdown */
export const options: INodePropertyOptions = {
	name: 'Get Peppol Document',
	value: 'getPeppolDocument',
	description: 'Retrieve a Peppol document by integration UUID',
	action: 'Get Peppol document',
};

const OPERATION = 'getPeppolDocument';

/**
 * Node properties (UI fields) for this operation.
 * Includes the zone field specific to Peppol document retrieval.
 */
export const properties: InvoicesProperties = [
	{
		displayName: 'Base URL',
		name: 'baseUrl',
		type: 'string',
		default: 'https://staging7.popapi.io/wp-json/api/v2/',
		displayOptions: { show: { resource: ['invoices'], operation: [OPERATION] } },
		description: 'Base URL of the POP API. Change only if your environment differs from the default.',
	},
	{
		displayName: 'Endpoint Path',
		name: 'path',
		type: 'string',
		default: 'peppol/document-get',
		displayOptions: { show: { resource: ['invoices'], operation: [OPERATION] } },
		description: 'Relative path of the POP endpoint for Peppol document retrieval',
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
		description: 'UUID of the integration for which to fetch the document',
	},
	{
		displayName: 'License Key',
		name: 'licenseKey',
		type: 'string',
		required: true,
		default: '',
		typeOptions: { password: true },
		displayOptions: {
			show: { resource: ['invoices'], operation: [OPERATION], inputMode: ['form'] },
		},
		description: 'POP license key to include in the request body',
	},
	// Zone field — required for Peppol access points in certain countries (e.g. Belgium)
	{
		displayName: 'Zone (Country Code)',
		name: 'zone',
		type: 'string',
		default: '',
		displayOptions: {
			show: { resource: ['invoices'], operation: [OPERATION], inputMode: ['form'] },
		},
		description:
			'Country zone for the integration (e.g. "BE"). Required when sending to Peppol for a BE VAT number. Leave empty to omit.',
	},
	// ── JSON body (visible when inputMode = json) ──
	{
		displayName: 'JSON Body',
		name: 'jsonBody',
		type: 'json',
		default:
			'{\n  "license_key": "your_license_key",\n  "integration": {\n    "uuid": "your_uuid",\n    "zone": "BE"\n  }\n}',
		displayOptions: {
			show: { resource: ['invoices'], operation: [OPERATION], inputMode: ['json'] },
		},
		description:
			'Complete request body as JSON. Must follow the POP API v2 peppol/document-get schema.',
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
 * Operation handler — builds and sends the peppol/document-get request.
 *
 * Form mode builds the payload with license_key and integration object.
 * The zone field is included only when the user provides a non-empty value,
 * normalized to uppercase (e.g. "be" → "BE").
 */
export async function handler(
	this: IExecuteFunctions,
	params: {
		baseUrl?: string;
		path: string;
		inputMode: 'form' | 'json' | 'raw' | 'passthrough';
		integrationUuid?: string;
		licenseKey?: string;
		zone?: string;
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
		// Normalize zone to uppercase; only include if non-empty
		const zoneValue = (params.zone ?? '').trim().toUpperCase();

		requestOptions.json = true;
		requestOptions.body = {
			license_key: params.licenseKey,
			integration: {
				uuid: params.integrationUuid,
				...(zoneValue ? { zone: zoneValue } : {}),
			},
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
