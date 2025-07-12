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

import { SQSClient, DeleteMessageCommand } from '@aws-sdk/client-sqs';

export class AwsSqsDelete implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'AWS SQS Delete',
		name: 'awsSqsExtendedDelete',
		icon: 'file:awssqs-delete.svg',
		group: ['transform'],
		version: 1,
		description: 'Delete From AWS SQS',
		subtitle: 'Delete From AWS SQS',
		defaults: {
			name: 'AWS SQS Delete',
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
				displayName: 'Queue URL',
				name: 'queueUrl',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'https://sqs.us-east-2.amazonaws.com/123456789012/your-queue-name.fifo',
				description: 'The URL of the SQS queue',
			},
			{
				displayName: 'Receipt Handle',
				name: 'receiptHandle',
				type: 'string',
				required: true,
				default: '',
				description: 'The receipt handle of the message to delete',
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

		const sqs = new SQSClient(config);

		for (let i = 0; i < items.length; i++) {
			try {
				const queueUrl = this.getNodeParameter('queueUrl', i) as string;
				const receiptHandle = this.getNodeParameter('receiptHandle', i) as string;

				const params = {
					QueueUrl: queueUrl,
					ReceiptHandle: receiptHandle,
				};

				const result = await sqs.send(new DeleteMessageCommand(params));

				returnData.push({
					json: {
						success: true,
						operation: 'deleteMessage',
						queueUrl,
						receiptHandle,
						requestId: result.$metadata.requestId,
						timestamp: new Date().toISOString(),
					},
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							success: false,
							error: errorMessage,
							operation: 'deleteMessage',
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