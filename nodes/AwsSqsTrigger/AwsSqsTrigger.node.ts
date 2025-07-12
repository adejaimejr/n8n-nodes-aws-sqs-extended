import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	NodeConnectionType,
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
				displayName: 'Queue URL',
				name: 'queueUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://sqs.us-east-1.amazonaws.com/123456789012/my-queue',
				description: 'The URL of the SQS queue to monitor',
			},
			{
				displayName: 'Polling Interval (seconds)',
				name: 'pollingInterval',
				type: 'number',
				default: 30,
				description: 'How often to check for new messages',
				typeOptions: {
					minValue: 10,
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
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const queueUrl = this.getNodeParameter('queueUrl') as string;
		const pollingInterval = this.getNodeParameter('pollingInterval') as number;
		const maxMessages = this.getNodeParameter('maxMessages') as number;
		const deleteAfterProcessing = this.getNodeParameter('deleteAfterProcessing') as boolean;

		const credentials = await this.getCredentials('aws');

		const config = {
			accessKeyId: credentials.accessKeyId as string,
			secretAccessKey: credentials.secretAccessKey as string,
			region: credentials.region as string,
		};

		const sqs = new AWS.SQS(config);

		const pollForMessages = async () => {
			try {
				const params: AWS.SQS.ReceiveMessageRequest = {
					QueueUrl: queueUrl,
					MaxNumberOfMessages: maxMessages,
					WaitTimeSeconds: 20, // Long polling
					MessageAttributeNames: ['All'],
				};

				const result = await sqs.receiveMessage(params).promise();

				if (result.Messages && result.Messages.length > 0) {
					for (const message of result.Messages) {
						const outputData = {
							MessageId: message.MessageId,
							Body: message.Body,
							ReceiptHandle: message.ReceiptHandle,
							MD5OfBody: message.MD5OfBody,
							MessageAttributes: message.MessageAttributes || {},
							Attributes: message.Attributes || {},
						};

						// Emit the message data
						this.emit([[{ json: outputData }]]);

						// Delete message if configured
						if (deleteAfterProcessing && message.ReceiptHandle) {
							try {
								await sqs.deleteMessage({
									QueueUrl: queueUrl,
									ReceiptHandle: message.ReceiptHandle,
								}).promise();
							} catch (deleteError) {
								console.error('Failed to delete message:', deleteError);
							}
						}
					}
				}
			} catch (error) {
				console.error('Error polling SQS:', error);
			}
		};

		// Start polling immediately
		pollForMessages();

		// Set up interval
		const intervalId = setInterval(pollForMessages, pollingInterval * 1000);

		// Return close function
		return {
			closeFunction: async () => {
				clearInterval(intervalId);
			},
		};
	}
} 