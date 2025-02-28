import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestMethods,
	IRequestOptions,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

interface IWantedLaaSResponse extends IDataObject {
	id: string;
	model: string;
	created: number;
	object: string;
	usage: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
	choices: Array<{
		message: {
			role: string;
			content: string;
		};
		finish_reason: string;
		index: number;
	}>;
}

export class WantedLaaS implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Wanted LaaS',
		name: 'wantedLaaS',
		icon: { light: 'file:WantedLaaS.svg', dark: 'file:WantedLaaS-dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Interact with Wanted LaaS API',
		defaults: {
			name: 'Wanted LaaS',
		},
		inputs: '={{["main"]}}',
		outputs: '={{["main"]}}',
		credentials: [
			{
				name: 'wantedLaaSApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Chat',
						value: 'chat',
						description: 'Send a chat message',
						action: 'Send a chat message',
					},
				],
				default: 'chat',
			},
			{
				displayName: 'Preset Hash',
				name: 'hash',
				type: 'string',
				noDataExpression: true,
				required: true,
				default: '',
				description:
					'The hash of the model to use. You can find this in the URL when viewing a model in the Wanted LaaS dashboard.',
			},
			{
				displayName: 'System Prompt',
				name: 'system_prompt',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '',
				description: 'System message to set the behavior of the assistant',
				placeholder: 'You are a helpful assistant...',
			},
			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: {
					rows: 4,
				},
				default: '={{ $json.chatInput }}',
				description: 'The message to send to the chat model',
			},
			{
				displayName: 'Params',
				name: 'params',
				type: 'json',
				default: '={}',
				description: 'Additional params to pass to the API',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
			},
			{
				displayName: 'Temperature',
				name: 'temperature',
				type: 'number',
				default: 0.9,
				description: 'What sampling temperature to use',
			},
			{
				displayName: 'Additional Fields',
				name: 'additionalFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				options: [
					{
						displayName: 'Response Format',
						name: 'response_format',
						type: 'options',
						options: [
							{
								name: 'Text',
								value: 'text',
								description: 'Text format response',
							},
							{
								name: 'JSON Object',
								value: 'json_object',
								description: 'JSON object format response',
							},
						],
						default: 'text',
						description: 'The format of the response',
					},
					{
						displayName: 'Max Tokens',
						name: 'max_tokens',
						type: 'number',
						default: 1000,
						description: 'The maximum number of tokens to generate',
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						default: 1,
						description: 'An alternative to sampling with temperature, called nucleus sampling',
					},
					{
						displayName: 'Frequency Penalty',
						name: 'frequency_penalty',
						type: 'number',
						default: 0,
						description:
							'Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency.',
					},
					{
						displayName: 'Presence Penalty',
						name: 'presence_penalty',
						type: 'number',
						default: 0,
						description:
							'Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far.',
					},
				],
			},
		],
	};

	methods = {};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('wantedLaaSApi');
		if (!credentials?.apiKey) {
			throw new NodeOperationError(this.getNode(), 'No valid API key provided');
		}

		for (let i = 0; i < items.length; i++) {
			const hash = this.getNodeParameter('hash', i) as string;
			const operation = this.getNodeParameter('operation', i) as string;
			const params = this.getNodeParameter('params', i, {}) as IDataObject;
			const systemPrompt = this.getNodeParameter('system_prompt', i, '') as string;
			const message = this.getNodeParameter('message', i, '') as string;
			const temperature = this.getNodeParameter('temperature', i) as number;
			const additionalFields = this.getNodeParameter('additionalFields', i) as IDataObject;

			let requestBody: IDataObject = {};
			try {
				if (operation === 'chat') {
					const messages = [];

					// Add system message if provided
					if (systemPrompt) {
						messages.push({
							role: 'system',
							content: systemPrompt,
						});
					}

					// Add user message
					if (message) {
						messages.push({
							role: 'user',
							content: message,
						});
					}

					requestBody = {
						hash,
						...additionalFields,
					};

					if (requestBody.params && Object.keys(requestBody.params).length > 0) {
						requestBody.params = typeof params === 'string' ? JSON.parse(params) : params;
					}

					if (messages && messages.length > 0) {
						requestBody.messages = messages;
					}

					if (temperature !== null && temperature !== undefined) {
						requestBody.temperature = temperature;
					}

					if (additionalFields.response_format) {
						// response_format이 설정된 경우 형식 조정
						requestBody.response_format = {
							type: additionalFields.response_format as string,
						};
						delete additionalFields.response_format;
					}

					const options: IRequestOptions = {
						method: 'POST' as IHttpRequestMethods,
						url: 'https://api-laas.wanted.co.kr/api/preset/v2/chat/completions',
						headers: {
							project: `${credentials.project}`,
							apiKey: `${credentials.apiKey}`,
							'Content-Type': 'application/json',
						},
						body: requestBody,
						json: true,
					};

					// 요청 데이터 로깅
					if (options.headers) {
						console.log('Request Data:', {
							url: options.url,
							body: JSON.stringify(requestBody, null, 2),
							headers: {
								project: options.headers.project,
								// apiKey는 보안상 제외
							},
						});
					}

					const response = await this.helpers.request(options);

					if (!response?.choices?.[0]?.message?.content) {
						throw new NodeOperationError(
							this.getNode(),
							'Invalid response format from Wanted LaaS API',
						);
					}

					const typedResponse = response as IWantedLaaSResponse;
					const messageContent = typedResponse.choices[0].message.content.trim();

					returnData.push({
						json: {
							response: messageContent,
						},
						pairedItem: { item: i },
					});
				}
			} catch (error) {
				// 에러 상세 정보 로깅
				console.error('Error details:', {
					message: error.message,
					response: error.response?.data,
					status: error.response?.status,
					headers: error.response?.headers,
					requestBody: JSON.stringify(requestBody, null, 2),
					stack: error.stack,
				});

				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: (error as Error).message,
							errorDetails: error.response?.data,
						},
						pairedItem: { item: i },
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
