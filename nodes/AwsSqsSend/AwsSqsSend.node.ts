import {
	ICredentialDataDecryptedObject,
	ICredentialTestFunctions,
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeListSearchResult,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import * as AWS from 'aws-sdk';

export class AwsSqsSend implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS Send',
		name: 'awsSqsSend',
		icon: 'file:awssqs.svg',
		group: ['transform'],
		version: 1,
		description: 'Send a Message to AWS SQS',
		subtitle: 'Send To Queue AWS SQS',
		defaults: {
			name: 'AWS SQS Send',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'aws',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Queue',
				name: 'queueUrl',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getQueues',
				},
				required: true,
				default: '',
				description: 'Select the SQS queue to send message to',
			},
			{
				displayName: 'Send Input Data',
				name: 'sendInputData',
				type: 'boolean',
				default: false,
				description: 'Whether to send the input data as message body',
			},
			{
				displayName: 'Message Body',
				name: 'messageBody',
				type: 'string',
				required: true,
				default: '',
				description: 'The content of the message to send',
				displayOptions: {
					show: {
						sendInputData: [false],
					},
				},
			},
			{
				displayName: 'Message Group ID',
				name: 'messageGroupId',
				type: 'string',
				default: '',
				description: 'Message group ID for FIFO queues (required for FIFO queues)',
				placeholder: 'my-group-id',
			},
			{
				displayName: 'Message Deduplication ID',
				name: 'messageDeduplicationId',
				type: 'string',
				default: '',
				description: 'Message deduplication ID for FIFO queues (optional if content-based deduplication is enabled)',
				placeholder: 'unique-message-id',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Message Attributes',
						name: 'messageAttributes',
						type: 'json',
						default: '{}',
						description: 'Message attributes as JSON object',
						placeholder: '{"attribute1": "value1", "attribute2": "value2"}',
					},
					{
						displayName: 'Delay Seconds',
						name: 'delaySeconds',
						type: 'number',
						default: 0,
						description: 'Number of seconds to delay message delivery (0-900)',
						typeOptions: {
							minValue: 0,
							maxValue: 900,
						},
					},
				],
			},
		],
	};

	methods = {
		loadOptions: {
			async getQueues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const credentials = await this.getCredentials('aws');
				
				const config = {
					accessKeyId: credentials.accessKeyId as string,
					secretAccessKey: credentials.secretAccessKey as string,
					region: credentials.region as string,
				};

				const sqs = new AWS.SQS(config);

				try {
					const result = await sqs.listQueues().promise();
					
					if (!result.QueueUrls || result.QueueUrls.length === 0) {
						return [
							{
								name: 'No queues found',
								value: '',
							},
						];
					}

					return result.QueueUrls.map((queueUrl) => {
						const queueName = queueUrl.split('/').pop() || queueUrl;
						return {
							name: queueName,
							value: queueUrl,
						};
					});
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					return [
						{
							name: `Error loading queues: ${errorMessage}`,
							value: '',
						},
					];
				}
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const credentials = await this.getCredentials('aws');

		const config = {
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
			region: credentials.region as string,
		};

		const sqs = new AWS.SQS(config);

		for (let i = 0; i < items.length; i++) {
			try {
				const queueUrl = this.getNodeParameter('queueUrl', i) as string;
				const sendInputData = this.getNodeParameter('sendInputData', i) as boolean;
				const messageGroupId = this.getNodeParameter('messageGroupId', i) as string;
				const messageDeduplicationId = this.getNodeParameter('messageDeduplicationId', i) as string;
				const additionalOptions = this.getNodeParameter('additionalOptions', i) as IDataObject;

				let messageBody: string;

				if (sendInputData) {
					// Use input data as message body
					messageBody = JSON.stringify(items[i].json);
				} else {
					// Use manual message body
					messageBody = this.getNodeParameter('messageBody', i) as string;
				}

				const params: AWS.SQS.SendMessageRequest = {
					QueueUrl: queueUrl,
					MessageBody: messageBody,
				};

				// Add Message Group ID if provided
				if (messageGroupId) {
					params.MessageGroupId = messageGroupId;
				}

				// Add Message Deduplication ID if provided
				if (messageDeduplicationId) {
					params.MessageDeduplicationId = messageDeduplicationId;
				}

				// Add optional parameters from Additional Options
				if (additionalOptions.messageAttributes) {
					const messageAttributes = additionalOptions.messageAttributes as string;
					if (messageAttributes && messageAttributes !== '{}') {
						try {
							const attributes = JSON.parse(messageAttributes);
							const convertedAttributes: { [key: string]: AWS.SQS.MessageAttributeValue } = {};
							
							for (const [key, value] of Object.entries(attributes)) {
								if (typeof value === 'string') {
									convertedAttributes[key] = {
										DataType: 'String',
										StringValue: value,
									};
								} else if (typeof value === 'number') {
									convertedAttributes[key] = {
										DataType: 'Number',
										StringValue: value.toString(),
									};
								} else if (typeof value === 'object' && value !== null) {
									const attr = value as any;
									convertedAttributes[key] = {
										DataType: attr.DataType || 'String',
										StringValue: attr.StringValue || attr.value,
									};
								}
							}
							params.MessageAttributes = convertedAttributes;
						} catch (error) {
							throw new NodeOperationError(
								this.getNode(),
								`Invalid Message Attributes JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
								{ itemIndex: i },
							);
						}
					}
				}

				if (additionalOptions.delaySeconds) {
					const delaySeconds = additionalOptions.delaySeconds as number;
					if (delaySeconds > 0) {
						params.DelaySeconds = delaySeconds;
					}
				}

				const result = await sqs.sendMessage(params).promise();

				returnData.push({
					json: {
						success: true,
						operation: 'sendMessage',
						queueUrl,
						messageId: result.MessageId,
						requestId: result.$response?.requestId,
						timestamp: new Date().toISOString(),
						messageBody: sendInputData ? 'Input data sent' : messageBody,
					},
				});

			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: errorMessage,
							operation: 'sendMessage',
							timestamp: new Date().toISOString(),
						},
					});
					continue;
				}

				throw new NodeOperationError(
					this.getNode(),
					`AWS SQS Error: ${errorMessage}`,
					{ itemIndex: i },
				);
			}
		}

		return [returnData];
	}
} 