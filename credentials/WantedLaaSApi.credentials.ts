import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
	Icon,
} from 'n8n-workflow';

export class WantedLaaSApi implements ICredentialType {
	name = 'wantedLaaSApi';

	displayName = 'Wanted LaaS API';

	icon: Icon = { light: 'file:WantedLaaS.svg', dark: 'file:WantedLaaS-dark.svg' };

	documentationUrl = 'https://laas.wanted.co.kr/docs/';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
		},
		{
			displayName: 'Project',
			name: 'project',
			type: 'string',
			typeOptions: { password: false },
			required: true,
			default: '',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				project: '={{$credentials.project}}',
				apiKey: '={{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api-laas.wanted.co.kr',
			url: '/model/refresh',
		},
	};
}
