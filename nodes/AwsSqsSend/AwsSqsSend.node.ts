import {
	ICredentialDataDecryptedObject,
	ICredentialTestFunctions,
	IDataObject,
	IExecuteFunctions,
	INodeCredentialTestResult,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
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
		description: 'Send messages to AWS SQS queues',
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
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Send Message',
						value: 'sendMessage',
						description: 'Send a single message to SQS queue',
						action: 'Send a message to SQS queue',
					},
					{
						name: 'Send Message Batch',
						value: 'sendMessageBatch',
						description: 'Send multiple messages to SQS queue in batch',
						action: 'Send multiple messages to SQS queue in batch',
					},
				],
				default: 'sendMessage',
			},
			{
				displayName: 'Queue URL',
				name: 'queueUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://sqs.us-east-2.amazonaws.com/123456789012/your-queue-name.fifo',
				description: 'The URL of the SQS queue',
			},
			// Send Message Parameters
			{
				displayName: 'Message Body',
				name: 'messageBody',
				type: 'string',
				required: true,
				default: '',
				description: 'The content of the message to send',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
					},
				},
			},
			{
				displayName: 'Message Attributes',
				name: 'messageAttributes',
				type: 'json',
				default: '{}',
				description: 'Message attributes as JSON object',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
					},
				},
			},
			{
				displayName: 'Delay Seconds',
				name: 'delaySeconds',
				type: 'number',
				default: 0,
				description: 'Number of seconds to delay message delivery (0-900)',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
					},
				},
			},
			{
				displayName: 'Message Group ID',
				name: 'messageGroupId',
				type: 'string',
				default: '',
				description: 'Message group ID for FIFO queues',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
					},
				},
			},
			{
				displayName: 'Message Deduplication ID',
				name: 'messageDeduplicationId',
				type: 'string',
				default: '',
				description: 'Message deduplication ID for FIFO queues',
				displayOptions: {
					show: {
						operation: ['sendMessage'],
					},
				},
			},
			// Send Message Batch Parameters
			{
				displayName: 'Messages',
				name: 'messages',
				type: 'json',
				required: true,
				default: '[]',
				description: 'Array of messages to send in batch format',
				displayOptions: {
					show: {
						operation: ['sendMessageBatch'],
					},
				},
			},
		],
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
				const operation = this.getNodeParameter('operation', i) as string;
				const queueUrl = this.getNodeParameter('queueUrl', i) as string;

				if (operation === 'sendMessage') {
					const messageBody = this.getNodeParameter('messageBody', i) as string;
					const messageAttributes = this.getNodeParameter('messageAttributes', i) as string;
					const delaySeconds = this.getNodeParameter('delaySeconds', i) as number;
					const messageGroupId = this.getNodeParameter('messageGroupId', i) as string;
					const messageDeduplicationId = this.getNodeParameter('messageDeduplicationId', i) as string;

					const params: AWS.SQS.SendMessageRequest = {
						QueueUrl: queueUrl,
						MessageBody: messageBody,
					};

					// Add optional parameters if provided
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

					if (delaySeconds > 0) {
						params.DelaySeconds = delaySeconds;
					}

					if (messageGroupId) {
						params.MessageGroupId = messageGroupId;
					}

					if (messageDeduplicationId) {
						params.MessageDeduplicationId = messageDeduplicationId;
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
						},
					});

				} else if (operation === 'sendMessageBatch') {
					const messagesParam = this.getNodeParameter('messages', i) as string;
					let messages: any[];

					try {
						messages = JSON.parse(messagesParam);
					} catch (error) {
						throw new NodeOperationError(
							this.getNode(),
							`Invalid Messages JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
							{ itemIndex: i },
						);
					}

					if (!Array.isArray(messages) || messages.length === 0) {
						throw new NodeOperationError(
							this.getNode(),
							'Messages must be a non-empty array',
							{ itemIndex: i },
						);
					}

					if (messages.length > 10) {
						throw new NodeOperationError(
							this.getNode(),
							'Maximum of 10 messages allowed per batch',
							{ itemIndex: i },
						);
					}

					const entries: AWS.SQS.SendMessageBatchRequestEntry[] = messages.map((message, index) => {
						const entry: AWS.SQS.SendMessageBatchRequestEntry = {
							Id: message.id || `msg_${index}`,
							MessageBody: message.messageBody || message.body,
						};

						if (message.messageAttributes) {
							const convertedAttributes: { [key: string]: AWS.SQS.MessageAttributeValue } = {};
							
							for (const [key, value] of Object.entries(message.messageAttributes)) {
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
							entry.MessageAttributes = convertedAttributes;
						}

						if (message.delaySeconds) {
							entry.DelaySeconds = message.delaySeconds;
						}

						if (message.messageGroupId) {
							entry.MessageGroupId = message.messageGroupId;
						}

						if (message.messageDeduplicationId) {
							entry.MessageDeduplicationId = message.messageDeduplicationId;
						}

						return entry;
					});

					const params: AWS.SQS.SendMessageBatchRequest = {
						QueueUrl: queueUrl,
						Entries: entries,
					};

					const result = await sqs.sendMessageBatch(params).promise();

					returnData.push({
						json: {
							success: true,
							operation: 'sendMessageBatch',
							queueUrl,
							successful: result.Successful,
							failed: result.Failed,
							requestId: result.$response.requestId,
							timestamp: new Date().toISOString(),
						},
					});
				}

			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: errorMessage,
							operation: this.getNodeParameter('operation', i) as string,
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