/**
 * POP API Credentials
 *
 * Stores a single POP Cloud API license key that is sent on every request
 * as the `X-API-Key` HTTP header. The POP API also accepts the same key
 * as a `license_key` body parameter — the n8n node keeps that fallback
 * for older API deployments that have not yet adopted the auth header.
 *
 * No `test` request is defined: the POP API has no dedicated
 * credential-validation endpoint, and reusing a real route with dummy data
 * causes n8n to fail the save dialog with "Couldn't connect with these
 * settings" even when the key is valid. Validity is verified at
 * first-use time by any operation that calls the API.
 */
/* eslint-disable @n8n/community-nodes/credential-test-required */
import type {
	IAuthenticateGeneric,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PopApi implements ICredentialType {
	name = 'popApi';

	displayName = 'POP API';

	icon = 'file:../nodes/Pop/pop.svg' as const;

	documentationUrl = 'https://github.com/getpopapi/n8n-nodes-pop#authentication';

	properties: INodeProperties[] = [
		{
			displayName: 'License Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'POP Cloud API license key. Sent as the X-API-Key header on every request.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				'X-API-Key': '={{$credentials.apiKey}}',
			},
		},
	};
}
