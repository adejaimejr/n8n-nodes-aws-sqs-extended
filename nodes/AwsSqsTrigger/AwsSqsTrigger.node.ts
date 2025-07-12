import {
	IDataObject,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	ITriggerFunctions,
	ITriggerResponse,
	INodeType,
	INodeTypeDescription,
	NodeConnectionType,
	NodeOperationError,
} from 'n8n-workflow';

import * as AWS from 'aws-sdk';

export class AwsSqsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS Trigger',
		name: 'awsSqsTrigger',
		icon: 'file:awssqs.svg',
		group: ['trigger'],
		version: 1,
		description: 'Trigger workflow when messages are received from AWS SQS',
		subtitle: 'Receive From Queue AWS SQS',
		defaults: {
			name: 'AWS SQS Trigger',
		},
		inputs: [],
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
				description: 'Select the SQS queue to monitor for messages',
			},
			{
				displayName: 'Polling Interval',
				name: 'pollingInterval',
				type: 'number',
				default: 10,
				description: 'How often to check for new messages (in seconds)',
				typeOptions: {
					minValue: 1,
					maxValue: 300,
				},
			},
			{
				displayName: 'Max Messages',
				name: 'maxMessages',
				type: 'number',
				default: 1,
				description: 'Maximum number of messages to retrieve per poll (1-10)',
				typeOptions: {
					minValue: 1,
					maxValue: 10,
				},
			},
			{
				displayName: 'Delete After Processing',
				name: 'deleteAfterProcessing',
				type: 'boolean',
				default: true,
				description: 'Whether to delete messages from the queue after processing',
			},
			{
				displayName: 'Additional Options',
				name: 'additionalOptions',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Visibility Timeout',
						name: 'visibilityTimeout',
						type: 'number',
						default: 30,
						description: 'The duration (in seconds) that the received messages are hidden from subsequent retrieve requests (0-43200)',
						typeOptions: {
							minValue: 0,
							maxValue: 43200,
						},
					},
					{
						displayName: 'Wait Time',
						name: 'waitTime',
						type: 'number',
						default: 0,
						description: 'The duration (in seconds) for which the call waits for a message to arrive (0-20)',
						typeOptions: {
							minValue: 0,
							maxValue: 20,
						},
					},
					{
						displayName: 'Include Message Attributes',
						name: 'includeMessageAttributes',
						type: 'boolean',
						default: true,
						description: 'Whether to include message attributes in the output',
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

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse | undefined> {
		const queueUrl = this.getNodeParameter('queueUrl') as string;
		const pollingInterval = this.getNodeParameter('pollingInterval') as number;
		const maxMessages = this.getNodeParameter('maxMessages') as number;
		const deleteAfterProcessing = this.getNodeParameter('deleteAfterProcessing') as boolean;
		const additionalOptions = this.getNodeParameter('additionalOptions') as IDataObject;

		const credentials = await this.getCredentials('aws');

		const config = {
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
			region: credentials.region as string,
		};

		const sqs = new AWS.SQS(config);

		const pollMessages = async () => {
			try {
				const params: AWS.SQS.ReceiveMessageRequest = {
					QueueUrl: queueUrl,
					MaxNumberOfMessages: maxMessages,
					WaitTimeSeconds: additionalOptions.waitTime as number || 0,
				};

				if (additionalOptions.visibilityTimeout) {
					params.VisibilityTimeout = additionalOptions.visibilityTimeout as number;
				}

				if (additionalOptions.includeMessageAttributes !== false) {
					params.MessageAttributeNames = ['All'];
				}

				const result = await sqs.receiveMessage(params).promise();

				if (result.Messages && result.Messages.length > 0) {
					for (const message of result.Messages) {
						const outputData: IDataObject = {
							MessageId: message.MessageId,
							Body: message.Body,
							ReceiptHandle: message.ReceiptHandle,
						};

						// Add optional fields if they exist
						if (message.MD5OfBody) {
							outputData.MD5OfBody = message.MD5OfBody;
						}

						if (message.Attributes) {
							outputData.Attributes = message.Attributes;
						}

						if (message.MessageAttributes && additionalOptions.includeMessageAttributes !== false) {
							// Convert message attributes to a more readable format
							const attributes: IDataObject = {};
							for (const [key, value] of Object.entries(message.MessageAttributes)) {
								attributes[key] = {
									DataType: value.DataType,
									StringValue: value.StringValue,
									BinaryValue: value.BinaryValue,
								};
							}
							outputData.MessageAttributes = attributes;
						}

						// Add FIFO specific fields from attributes if available
						if (message.Attributes && message.Attributes.MessageGroupId) {
							outputData.MessageGroupId = message.Attributes.MessageGroupId;
						}

						if (message.Attributes && message.Attributes.MessageDeduplicationId) {
							outputData.MessageDeduplicationId = message.Attributes.MessageDeduplicationId;
						}

						if (message.Attributes && message.Attributes.SequenceNumber) {
							outputData.SequenceNumber = message.Attributes.SequenceNumber;
						}

						// Emit the message to trigger the workflow
						const executionData: INodeExecutionData = {
							json: outputData,
						};

						this.emit([[executionData]]);

						// Delete message if configured to do so
						if (deleteAfterProcessing && message.ReceiptHandle) {
							try {
								await sqs.deleteMessage({
									QueueUrl: queueUrl,
									ReceiptHandle: message.ReceiptHandle,
								}).promise();
							} catch (deleteError) {
								const errorMessage = deleteError instanceof Error ? deleteError.message : 'Unknown error';
								this.emit([[{
									json: {
										error: `Failed to delete message: ${errorMessage}`,
										messageId: message.MessageId,
									},
								}]]);
							}
						}
					}
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				this.emit([[{
					json: {
						error: `Failed to poll messages: ${errorMessage}`,
						timestamp: new Date().toISOString(),
					},
				}]]);
			}
		};

		// Start polling
		const intervalId = setInterval(pollMessages, pollingInterval * 1000);

		// Poll immediately on start
		pollMessages();

		// Function to stop polling when the workflow is deactivated
		const stopPolling = async () => {
			clearInterval(intervalId);
		};

		// Return the stop function
		return {
			closeFunction: stopPolling,
		};
	}
} 