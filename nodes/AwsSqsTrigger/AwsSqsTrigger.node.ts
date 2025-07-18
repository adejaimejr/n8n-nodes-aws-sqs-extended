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
		name: 'awsSqsExtendedTrigger',
		icon: 'file:awssqs-trigger.svg',
		group: ['trigger'],
		version: 1,
		description: 'Consumer AWS SQS',
		subtitle: 'Consumer AWS SQS',
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
				displayName: 'Queue Input Method',
				name: 'queueInputMethod',
				type: 'options',
				options: [
					{
						name: 'Select from List',
						value: 'list',
					},
					{
						name: 'Enter URL Manually',
						value: 'manual',
					},
				],
				default: 'list',
				description: 'Choose how to specify the SQS queue',
			},
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
				displayOptions: {
					show: {
						queueInputMethod: ['list'],
					},
				},
			},
			{
				displayName: 'Queue URL',
				name: 'queueUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://sqs.us-east-1.amazonaws.com/123456789012/your-queue-name',
				description: 'The full URL of the SQS queue to monitor',
				displayOptions: {
					show: {
						queueInputMethod: ['manual'],
					},
				},
			},
			{
				displayName: 'Interval',
				name: 'interval',
				type: 'number',
				default: 30,
				description: '🔄 Frequency: How often to check the queue for new messages (independent of each call duration)',
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
				displayName: 'Delete Messages',
				name: 'deleteMessages',
				type: 'boolean',
				default: false,
				description: 'Whether to delete messages after receiving them. Enable only if you want to consume messages.',
			},
			{
				displayName: 'Visibility Timeout',
				name: 'visibilityTimeout',
				type: 'number',
				default: 30,
				description: 'Duration (in seconds) that received messages are hidden from subsequent retrieve requests',
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
				description: '⏱️ Per-call wait: How long each individual call waits for messages (0=instant return, 20=wait up to 20s for efficiency)',
				typeOptions: {
					minValue: 0,
					maxValue: 20,
				},
			},
		],
	};

	methods = {
		loadOptions: {
			async getQueues(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				try {
					const credentials = await this.getCredentials('aws');
					
					const config = {
						accessKeyId: credentials.accessKeyId as string,
						secretAccessKey: credentials.secretAccessKey as string,
						region: credentials.region as string,
					};

					const sqs = new SQSClient(config);
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
					// Return empty array if there's an error, allow manual input as fallback
					console.error('Failed to load queues:', error);
					return [];
				}
			},
		},
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const queueInputMethod = this.getNodeParameter('queueInputMethod') as string;
		let queueUrl: string;
		
		if (queueInputMethod === 'manual') {
			queueUrl = this.getNodeParameter('queueUrl') as string;
		} else {
			queueUrl = this.getNodeParameter('queue') as string;
		}

		const interval = this.getNodeParameter('interval') as number;
		const unit = this.getNodeParameter('unit') as string;
		const deleteMessages = this.getNodeParameter('deleteMessages', false) as boolean;
		const visibilityTimeout = this.getNodeParameter('visibilityTimeout', 30) as number;
		const maxMessages = this.getNodeParameter('maxMessages', 1) as number;
		const waitTimeSeconds = this.getNodeParameter('waitTimeSeconds', 20) as number;

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