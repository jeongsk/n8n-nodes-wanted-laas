import { ChatOpenAI, type ClientOptions } from '@langchain/openai';
import type {
	IDataObject,
	IHttpRequestMethods,
	INodeType,
	INodeTypeDescription,
	IRequestOptions,
	ISupplyDataFunctions,
	SupplyData,
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

export class LmChatWantedLaaS implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Wanted LaaS Chat Model',
		name: 'lmChatWantedLaaS',
		icon: { light: 'file:WantedLaaS.svg', dark: 'file:WantedLaaS-dark.svg' },
		group: ['transform'],
		version: [1],
		description: 'For advanced usage with an AI chain',
		defaults: {
			name: 'Wanted LaaS Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatopenai/',
					},
				],
			},
		},

		inputs: [], // eslint-disable-line
		outputs: ['ai_languageModel'] as any, // eslint-disable-line
		outputNames: ['Model'],
		credentials: [
			{
				name: 'wantedLaaSApi',
				required: true,
			},
		],
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: 'https://api-laas.wanted.co.kr/api/preset/v2/',
		},
		properties: [
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
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Frequency Penalty',
						name: 'frequency_penalty',
						type: 'number',
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberPrecision: 1,
						},
						default: 0,
						description:
							"Positive values penalize new tokens based on their existing frequency in the text so far, decreasing the model's likelihood to repeat the same line verbatim",
					},
					{
						displayName: 'Max Retries',
						name: 'maxRetries',
						default: 2,
						description: 'Maximum number of retries to attempt',
						type: 'number',
					},
					{
						displayName: 'Maximum Number of Tokens',
						name: 'max_tokens',
						type: 'number',
						default: -1,
						description:
							'The maximum number of tokens to generate in the completion. Most models have a context length of 2048 tokens (except for the newest models, which support 32,768).',
						typeOptions: {
							maxValue: 32768,
						},
					},
					{
						displayName: 'Presence Penalty',
						name: 'presence_penalty',
						type: 'number',
						typeOptions: {
							minValue: -2,
							maxValue: 2,
							numberPrecision: 1,
						},
						default: 0,
						description:
							"Positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics",
					},
					{
						displayName: 'Response Format',
						name: 'responseFormat',
						type: 'options',
						options: [
							{
								name: 'Text',
								value: 'text',
								description: 'Regular text response',
							},
							{
								name: 'JSON Object',
								value: 'json_object',
								description:
									'Enables JSON mode, which should guarantee the message the model generates is valid JSON',
							},
						],
						default: 'text',
						description: 'The format of the response',
					},
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 2,
							numberPrecision: 1,
						},
						default: 0.7,
						description:
							'Controls randomness: Lowering results in less random completions. As the temperature approaches zero, the model will become deterministic and repetitive.',
					},
					{
						displayName: 'Timeout',
						name: 'timeout',
						default: 60000,
						description: 'Maximum amount of time a request is allowed to take in milliseconds',
						type: 'number',
					},
					{
						displayName: 'Top P',
						name: 'top_p',
						type: 'number',
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						default: 1,
						description:
							'Controls diversity via nucleus sampling: 0.5 means half of all likelihood-weighted options are considered. We generally recommend altering this or temperature but not both.',
					},
				],
			},
			{
				displayName: 'Additional Parameters',
				name: 'params',
				type: 'json',
				default: '{}',
				description: 'Additional parameters to pass to the API',
				typeOptions: {
					alwaysOpenEditWindow: true,
				},
			},
		],
	};

	methods = {};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('wantedLaaSApi');

		if (!credentials?.apiKey) {
			throw new NodeOperationError(this.getNode(), 'No valid API key provided');
		}
		if (!credentials?.project) {
			throw new NodeOperationError(this.getNode(), 'No valid project provided');
		}

		const hash = this.getNodeParameter('hash', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			frequencyPenalty?: number;
			maxTokens?: number;
			maxRetries: number;
			timeout: number;
			presencePenalty?: number;
			temperature?: number;
			topP?: number;
			responseFormat?: 'text' | 'json_object';
			reasoningEffort?: 'low' | 'medium' | 'high';
		};
		const additionalParams = this.getNodeParameter('params', itemIndex, {}) as IDataObject;

		if (!hash.trim()) {
			throw new NodeOperationError(this.getNode(), 'Preset Hash cannot be empty');
		}

		const configuration: ClientOptions = {
			baseURL: 'https://api-laas.wanted.co.kr/api/preset/v2',
			defaultHeaders: {
				'Content-Type': 'application/json',
				project: `${credentials.project}`,
				apiKey: `${credentials.apiKey}`,
			},
			fetch: async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
				const endpoint = typeof url === 'string' ? url : url.toString();
				const isCompletionsEndpoint = endpoint.includes('/chat/completions');
				
				if (!isCompletionsEndpoint) {
					return new Response(JSON.stringify({ error: 'Unsupported endpoint' }), {
						status: 404,
						headers: { 'Content-Type': 'application/json' },
					});
				}

				const body = init?.body ? JSON.parse(init.body as string) : {};
				
				const requestBody: IDataObject = {
					hash,
					messages: body.messages || [],
					temperature: body.temperature,
					max_tokens: body.max_tokens,
					top_p: body.top_p,
					frequency_penalty: body.frequency_penalty,
					presence_penalty: body.presence_penalty,
				};

				if (body.response_format) {
					requestBody.response_format = body.response_format;
				}

				if (additionalParams && Object.keys(additionalParams).length > 0) {
					try {
						const parsedParams =
							typeof additionalParams === 'string'
								? JSON.parse(additionalParams)
								: additionalParams;

						requestBody.params = parsedParams;
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid params format: ${error.message}`,
						);
					}
				}

				const requestOptions: IRequestOptions = {
					method: 'POST' as IHttpRequestMethods,
					url: 'https://api-laas.wanted.co.kr/api/preset/v2/chat/completions',
					headers: {
						'Content-Type': 'application/json',
						project: `${credentials.project}`,
						apiKey: `${credentials.apiKey}`,
					},
					body: requestBody,
					json: true,
					timeout: options.timeout ?? 60000,
				};

				try {
					const response = (await this.helpers.request(requestOptions)) as IWantedLaaSResponse;
					
					const openAIResponse = {
						id: response.id,
						object: response.object,
						created: response.created,
						model: response.model || hash,
						choices: response.choices,
						usage: response.usage,
					};

					return new Response(JSON.stringify(openAIResponse), {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
					});
				} catch (error) {
					console.error('Error calling Wanted LaaS API:', error);
					return new Response(JSON.stringify({ error: error.message }), {
						status: 500,
						headers: { 'Content-Type': 'application/json' },
					});
				}
			},
		};

		const model = new ChatOpenAI({
			openAIApiKey: credentials.apiKey as string,
			model: hash,
			temperature: options.temperature,
			maxTokens: options.maxTokens === -1 ? undefined : options.maxTokens,
			topP: options.topP,
			frequencyPenalty: options.frequencyPenalty,
			presencePenalty: options.presencePenalty,
			timeout: options.timeout ?? 60000,
			maxRetries: options.maxRetries ?? 2,
			configuration,
		});

		if (options.responseFormat === 'json_object') {
			model.modelKwargs = {
				response_format: { type: 'json_object' },
			};
		}

		return {
			response: model,
		};
	}
}
