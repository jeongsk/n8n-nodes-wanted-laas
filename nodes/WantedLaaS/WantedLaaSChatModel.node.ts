import type {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	IDataObject,
	IHttpRequestMethods,
	IRequestOptions,
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

export class WantedLaaSChatModel implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Wanted LaaS Chat Model',
		name: 'wantedLaasChatModel',
		icon: { light: 'file:WantedLaaS.svg', dark: 'file:WantedLaaS-dark.svg' },
		group: ['transform'],
		version: 1,
		description: 'Wanted LaaS Language Model for AI Agents and Chains',
		defaults: {
			name: 'Wanted LaaS Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.wanted.co.kr/laas',
					},
				],
			},
		},
		inputs: ['main'],
		outputs: ['main'],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'wantedLaaSApi',
				required: true,
			},
		],
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
				displayName: 'Model Parameters',
				name: 'modelParameters',
				type: 'collection',
				placeholder: 'Add Parameter',
				default: {},
				options: [
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
						description: 'Controls randomness in the output',
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
						typeOptions: {
							minValue: 0,
							maxValue: 1,
							numberPrecision: 2,
						},
						default: 1,
						description: 'An alternative to sampling with temperature, called nucleus sampling',
					},
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
							'Number between -2.0 and 2.0. Positive values penalize new tokens based on their existing frequency',
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
							'Number between -2.0 and 2.0. Positive values penalize new tokens based on whether they appear in the text so far',
					},
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

	async supplyData(this: IExecuteFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = await this.getCredentials('wantedLaaSApi');

		if (!credentials?.apiKey) {
			throw new NodeOperationError(this.getNode(), 'No valid API key provided');
		}
		if (!credentials?.project) {
			throw new NodeOperationError(this.getNode(), 'No valid project provided');
		}

		const hash = this.getNodeParameter('hash', itemIndex) as string;
		const modelParameters = this.getNodeParameter('modelParameters', itemIndex, {}) as IDataObject;
		const additionalParams = this.getNodeParameter('params', itemIndex, {}) as IDataObject;

		if (!hash.trim()) {
			throw new NodeOperationError(this.getNode(), 'Preset Hash cannot be empty');
		}

		return {
			response: {
				model: {
					invoke: async (prompt: string) => {
						const messages = [
							{
								role: 'user',
								content: prompt,
							},
						];

						const requestBody: IDataObject = {
							hash,
							messages,
							...modelParameters,
						};

						// Handle response_format properly
						if (modelParameters.response_format) {
							requestBody.response_format = {
								type: modelParameters.response_format as string,
							};
						}

						// Merge additional parameters
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

						try {
							const response = (await this.helpers.request(options)) as IWantedLaaSResponse;

							if (!response?.choices?.[0]?.message?.content) {
								throw new NodeOperationError(
									this.getNode(),
									'Invalid response format from Wanted LaaS API',
								);
							}

							return {
								output: response.choices[0].message.content,
							};
						} catch (error) {
							if (error.response) {
								const statusCode = error.response.status;
								let errorMessage = 'Wanted LaaS API error';

								switch (statusCode) {
									case 400:
										errorMessage = 'Bad request: Please check your input parameters';
										break;
									case 401:
										errorMessage = 'Authentication failed: Please check your API credentials';
										break;
									case 403:
										errorMessage = 'Access forbidden: Please check your API permissions';
										break;
									case 429:
										errorMessage = 'Too many requests: Please try again later';
										break;
									default:
										errorMessage = `API Error (${statusCode}): ${error.response.data?.message || error.message}`;
								}

								throw new NodeOperationError(this.getNode(), errorMessage);
							}
							throw error;
						}
					},
				},
			},
		};
	}
}
