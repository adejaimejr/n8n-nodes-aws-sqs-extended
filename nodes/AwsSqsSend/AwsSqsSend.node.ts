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
		displayName: 'AWS SQS Send Full',
		name: 'awsSqsFullSend',
		icon: 'file:awssqs-send.svg',
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
				default: true,
				description: 'Whether to send the data the node receives as JSON to SQS',
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
				default: '={{ Date.now().toString() }}',
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
						type: 'fixedCollection',
						description: 'Message attributes to send with the message',
						default: {},
						typeOptions: {
							multipleValues: true,
						},
						options: [
							{
								name: 'attribute',
								displayName: 'Attribute',
								values: [
									{
										displayName: 'Name',
										name: 'name',
										type: 'string',
										default: '',
										description: 'Name of the attribute',
										placeholder: 'attribute-name',
									},
									{
										displayName: 'Data Type',
										name: 'dataType',
										type: 'options',
										options: [
											{
												name: 'String',
												value: 'String',
											},
											{
												name: 'Number',
												value: 'Number',
											},
											{
												name: 'Binary',
												value: 'Binary',
											},
										],
										default: 'String',
										description: 'Data type of the attribute',
									},
									{
										displayName: 'Value',
										name: 'value',
										type: 'string',
										default: '',
										description: 'Value of the attribute',
										placeholder: 'attribute-value',
									},
								],
							},
						],
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
					const messageAttributesCollection = additionalOptions.messageAttributes as IDataObject;
					const messageAttributes = messageAttributesCollection.attribute as IDataObject[];
					if (messageAttributes && messageAttributes.length > 0) {
						const convertedAttributes: { [key: string]: AWS.SQS.MessageAttributeValue } = {};
						
						for (const attr of messageAttributes) {
							const name = attr.name as string;
							const dataType = attr.dataType as string;
							const value = attr.value as string;

							if (name && value) {
								if (dataType === 'Binary') {
									convertedAttributes[name] = {
										DataType: dataType,
										BinaryValue: Buffer.from(value, 'utf8'),
									};
								} else {
									convertedAttributes[name] = {
										DataType: dataType,
										StringValue: value,
									};
								}
							}
						}
						params.MessageAttributes = convertedAttributes;
					}
				}

				if (additionalOptions.delaySeconds) {
					const delaySeconds = additionalOptions.delaySeconds as number;
					if (delaySeconds > 0) {
						params.DelaySeconds = delaySeconds;
					}
				}

				const result = await sqs.sendMessage(params).promise();

				const outputData: any = {
					MessageId: result.MessageId,
					MD5OfMessageBody: result.MD5OfMessageBody,
				};

				// Add SequenceNumber for FIFO queues
				if (result.SequenceNumber) {
					outputData.SequenceNumber = result.SequenceNumber;
				}

				returnData.push({
					json: outputData,
				});

			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: errorMessage,
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