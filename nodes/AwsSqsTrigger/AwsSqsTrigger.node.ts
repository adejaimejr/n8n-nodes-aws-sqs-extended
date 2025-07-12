import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	NodeConnectionType,
	IDataObject,
	NodeOperationError,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, ListQueuesCommand } from '@aws-sdk/client-sqs';

export class AwsSqsTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS Trigger',
		name: 'awsSqsFullTrigger',
		icon: 'file:awssqs-trigger.svg',
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
				displayName: 'Queue Name or ID',
				name: 'queue',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getQueues',
				},
				required: true,
				default: '',
				description: 'Select the SQS queue to monitor',
			},
			{
				displayName: 'Interval',
				name: 'interval',
				type: 'number',
				default: 30,
				description: 'Interval value which the queue will be checked for new messages',
				typeOptions: {
					minValue: 1,
					maxValue: 999,
				},
			},
			{
				displayName: 'Unit',
				name: 'unit',
				type: 'options',
				options: [
					{
						name: 'Seconds',
						value: 'seconds',
					},
					{
						name: 'Minutes',
						value: 'minutes',
					},
				],
				default: 'seconds',
				description: 'Unit of the interval value',
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Delete Messages',
						name: 'deleteMessages',
						type: 'boolean',
						default: true,
						description: 'Whether to delete messages after receiving them',
					},
					{
						displayName: 'Visibility Timeout',
						name: 'visibilityTimeout',
						type: 'number',
						default: 30,
						description: 'The duration (in seconds) that the received messages are hidden from subsequent retrieve requests',
						typeOptions: {
							minValue: 0,
							maxValue: 43200, // 12 hours max
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
						displayName: 'Wait Time Seconds',
						name: 'waitTimeSeconds',
						type: 'number',
						default: 20,
						description: 'The duration (in seconds) for which the call waits for a message to arrive (long polling)',
						typeOptions: {
							minValue: 0,
							maxValue: 20,
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

				const sqs = new SQSClient(config);

				try {
					const queues = await sqs.send(new ListQueuesCommand({}));
					const returnData: INodePropertyOptions[] = [];

					if (queues.QueueUrls) {
						for (const queueUrl of queues.QueueUrls) {
							const queueName = queueUrl.split('/').pop() || queueUrl;
							returnData.push({
								name: queueName,
								value: queueUrl,
							});
						}
					}

					return returnData.sort((a, b) => a.name.localeCompare(b.name));
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : 'Unknown error';
					throw new NodeOperationError(this.getNode(), `Failed to load queues: ${errorMessage}`);
				}
			},
		},
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const queueUrl = this.getNodeParameter('queue') as string;
		const interval = this.getNodeParameter('interval') as number;
		const unit = this.getNodeParameter('unit') as string;
		const options = this.getNodeParameter('options') as IDataObject;

		// Parse options with defaults
		const deleteMessages = options.deleteMessages !== undefined ? options.deleteMessages as boolean : true;
		const visibilityTimeout = options.visibilityTimeout as number || 30;
		const maxMessages = options.maxMessages as number || 1;
		const waitTimeSeconds = options.waitTimeSeconds as number || 20;

		// Convert interval to milliseconds
		const intervalMs = unit === 'minutes' ? interval * 60 * 1000 : interval * 1000;

		const credentials = await this.getCredentials('aws');

		const config = {
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
			region: credentials.region as string,
		};

		const sqs = new SQSClient(config);

		const pollForMessages = async () => {
			try {
				const params = {
					QueueUrl: queueUrl,
					MaxNumberOfMessages: maxMessages,
					WaitTimeSeconds: waitTimeSeconds,
					VisibilityTimeout: visibilityTimeout,
					MessageAttributeNames: ['All'],
				};

				const result = await sqs.send(new ReceiveMessageCommand(params));

				if (result.Messages && result.Messages.length > 0) {
					for (const message of result.Messages) {
						const outputData = {
							MessageId: message.MessageId,
							Body: message.Body,
							ReceiptHandle: message.ReceiptHandle,
							MD5OfBody: message.MD5OfBody,
							MessageAttributes: message.MessageAttributes || {},
							Attributes: message.Attributes || {},
							QueueUrl: queueUrl,
						};

						// Emit the message data
						this.emit([[{ json: outputData }]]);

						// Delete message if configured
						if (deleteMessages && message.ReceiptHandle) {
							try {
								await sqs.send(new DeleteMessageCommand({
									QueueUrl: queueUrl,
									ReceiptHandle: message.ReceiptHandle,
								}));
							} catch (deleteError) {
								const errorMessage = deleteError instanceof Error ? deleteError.message : 'Unknown error';
								console.error('Failed to delete message:', errorMessage);
							}
						}
					}
				}
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				console.error('Error polling SQS:', errorMessage);
			}
		};

		// Start polling immediately
		pollForMessages();

		// Set up interval
		const intervalId = setInterval(pollForMessages, intervalMs);

		// Return close function
		return {
			closeFunction: async () => {
				clearInterval(intervalId);
			},
		};
	}
} 