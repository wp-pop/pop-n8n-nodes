/**
 * POP API Credentials
 *
 * Stores the base URL and Bearer token used to authenticate against
 * the POP Cloud API (v2). The license key is NOT stored here — it is
 * sent inside each request payload, allowing different keys per workflow.
 *
 * Authentication flow:
 * 1. User configures base URL and API token in n8n credentials screen
 * 2. n8n injects the Bearer token into every outgoing request via the
 *    `authenticate` property (IAuthenticateGeneric)
 * 3. The `test` property allows n8n to verify credentials by hitting
 *    the API root endpoint
 */
import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class PopApi implements ICredentialType {
	name = 'popApi';

	icon = 'file:pop.svg' as const;

	displayName = 'POP API';

	documentationUrl = 'https://documenter.getpostman.com/view/41622997/2sAYkLmGT8';

	properties: INodeProperties[] = [
		{
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://api.example.com',
			description: 'POP API base URL (as shown in the official documentation)',
		},
		{
			displayName: 'API token',
			name: 'apiToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'Bearer token (or API key) provided by POP',
		},
	];

	// Inject the Bearer token into every outgoing request automatically
	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Bearer " + $credentials.apiToken}}',
			},
		},
	};

	// Verify credentials by making a GET request to the API root
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl}}',
			url: '/',
			method: 'GET',
		},
	};
}
