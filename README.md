# AWS SQS Pro - n8n Community Node

<div align="center">
  <img src="https://github.com/adejaimejr/n8n-nodes-sqs-pro/raw/main/assets/automate-without-limits.png" alt="Automate without limits" width="600" />
</div>

<br />

[![npm version](https://img.shields.io/npm/v/n8n-nodes-sqs-pro)](https://www.npmjs.com/package/n8n-nodes-sqs-pro)
[![license](https://img.shields.io/npm/l/n8n-nodes-sqs-pro)](https://github.com/adejaimejr/n8n-nodes-sqs-pro/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/n8n-nodes-sqs-pro)](https://www.npmjs.com/package/n8n-nodes-sqs-pro)
[![n8n-community-node](https://img.shields.io/badge/n8n-community%20node-blueviolet)](https://n8n.io/integrations/community-nodes/)

> 🎯 **Professional AWS SQS nodes for n8n** - Send & Delete messages from SQS queues with ease

## ✨ Features

- 📤 **Message Sending** - Send messages to SQS queues with automatic queue discovery
- 🗑️ **Message Deletion** - Delete messages from SQS queues efficiently
- 🔄 **Dynamic Queue Loading** - Automatically loads your SQS queues from AWS credentials
- 📊 **Send Input Data** - Option to send workflow input data as message body
- 🛡️ **Error Handling** - Robust error handling with continue-on-fail support
- 🔐 **Native AWS Credentials** - Uses n8n's built-in AWS credentials
- 📈 **FIFO Support** - Full support for FIFO queues with Message Group ID and Deduplication ID
- 🏷️ **Message Attributes** - Support for custom message attributes
- ⏱️ **Delay Messages** - Delay message delivery up to 15 minutes
- ⚡ **High Performance** - Optimized for production workloads

## 🔧 Installation

### Via n8n Community Nodes (Recommended)

1. Go to **Settings** → **Community Nodes** in your n8n instance
2. Click **Install** and enter: `n8n-nodes-sqs-pro`
3. Click **Install** and wait for the installation to complete

### Via npm

```bash
npm install n8n-nodes-sqs-pro
```

### Requirements

- **n8n version**: 0.198.0 or higher
- **Node.js**: 16.0.0 or higher
- **AWS Account** with SQS access

## 🚀 Quick Start

### 1. Configure AWS Credentials

Create AWS credentials in n8n:

1. Go to **Settings** → **Credentials**
2. Click **Add Credential**
3. Select **AWS**
4. Enter your AWS credentials:
   - **Access Key ID**: Your AWS access key
   - **Secret Access Key**: Your AWS secret key
   - **Region**: Your AWS region (e.g., `us-east-1`)

### 2. Add the Nodes to Your Workflow

#### AWS SQS Send

1. Create a new workflow
2. Add the **AWS SQS Send** node
3. Select your queue from the dropdown (auto-loaded from your AWS account)
4. Configure message options

#### AWS SQS Delete

1. Add the **AWS SQS Delete** node
2. Configure the queue URL and receipt handle

## 📋 Operations

### AWS SQS Send

Send messages to SQS queues with intelligent queue discovery.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Queue | dropdown | ✅ | Select from your available SQS queues |
| Send Input Data | boolean | ✅ | Send workflow input data as message body |
| Message Body | string | ✅* | Message content (*when Send Input Data is false) |
| Message Group ID | string | ⭕ | Required for FIFO queues |
| Message Deduplication ID | string | ❌ | Optional for FIFO queues |

**Additional Options:**

| Parameter | Type | Description |
|-----------|------|-------------|
| Message Attributes | JSON | Custom message attributes |
| Delay Seconds | number | Delay delivery (0-900 seconds) |

**Example Configuration:**

```json
{
  "queue": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue.fifo",
  "sendInputData": false,
  "messageBody": "Hello from n8n!",
  "messageGroupId": "order-processing",
  "messageDeduplicationId": "order-123456",
  "additionalOptions": {
    "messageAttributes": "{\"priority\": \"high\", \"source\": \"n8n\"}",
    "delaySeconds": 30
  }
}
```

### AWS SQS Delete

Delete messages from SQS queues.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Queue URL | string | ✅ | The full URL of the SQS queue |
| Receipt Handle | string | ✅ | The receipt handle of the message to delete |

## 💡 Use Cases

### 1. Send Order Notifications

```json
{
  "nodes": [
    {
      "name": "Order Created",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "order-created"
      }
    },
    {
      "name": "Send to Queue",
      "type": "n8n-nodes-sqs-pro-send",
      "parameters": {
        "queue": "https://sqs.us-east-1.amazonaws.com/123456789012/orders.fifo",
        "sendInputData": true,
        "messageGroupId": "orders",
        "additionalOptions": {
          "messageAttributes": "{\"orderType\": \"new\", \"priority\": \"high\"}"
        }
      }
    }
  ]
}
```

### 2. Process and Delete Messages

```json
{
  "nodes": [
    {
      "name": "Receive Message",
      "type": "n8n-nodes-base.awsSqs",
      "parameters": {
        "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue"
      }
    },
    {
      "name": "Process Message",
      "type": "n8n-nodes-base.function",
      "parameters": {
        "functionCode": "// Process your message here\nreturn items;"
      }
    },
    {
      "name": "Delete Message",
      "type": "n8n-nodes-sqs-pro-delete",
      "parameters": {
        "queueUrl": "{{$node['Receive Message'].json.queueUrl}}",
        "receiptHandle": "{{$node['Receive Message'].json.receiptHandle}}"
      }
    }
  ]
}
```

### 3. Delayed Message Processing

```json
{
  "parameters": {
    "queue": "https://sqs.us-east-1.amazonaws.com/123456789012/delayed-tasks",
    "sendInputData": false,
    "messageBody": "Process this in 5 minutes",
    "additionalOptions": {
      "delaySeconds": 300
    }
  }
}
```

## 🔐 AWS IAM Permissions

Your AWS user needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:SendMessage",
        "sqs:DeleteMessage",
        "sqs:ListQueues",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:*:*:*"
    }
  ]
}
```

## 📊 Output

### AWS SQS Send Output

```json
{
  "success": true,
  "operation": "sendMessage",
  "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
  "messageId": "12345678-1234-1234-1234-123456789012",
  "requestId": "87654321-4321-4321-4321-210987654321",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "messageBody": "Input data sent"
}
```

### AWS SQS Delete Output

```json
{
  "success": true,
  "operation": "deleteMessage",
  "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
  "receiptHandle": "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a...",
  "requestId": "12345678-1234-1234-1234-123456789012",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🛠️ Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/adejaimejr/n8n-nodes-sqs-pro.git

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Project Structure

```
n8n-nodes-sqs-pro/
├── nodes/
│   ├── AwsSqsDelete/
│   │   ├── AwsSqsDelete.node.ts    # Delete node implementation
│   │   └── awssqs.svg              # Node icon
│   └── AwsSqsSend/
│       ├── AwsSqsSend.node.ts      # Send node implementation
│       └── awssqs.svg              # Node icon
├── dist/                           # Built files
├── package.json                    # Package configuration
└── README.md                       # This file
```

## 🔗 Useful Links

- 📚 [AWS SQS Documentation](https://docs.aws.amazon.com/sqs/)
- 🔧 [n8n Community Nodes](https://n8n.io/integrations/community-nodes/)
- 🐛 [Report Issues](https://github.com/adejaimejr/n8n-nodes-sqs-pro/issues)
- 💬 [n8n Community](https://community.n8n.io/)
- 📖 [n8n Documentation](https://docs.n8n.io/)

## ❓ FAQ

### Q: Can I use this with FIFO queues?
**A:** Yes! Both nodes work with Standard and FIFO SQS queues. For FIFO queues, make sure to provide Message Group ID.

### Q: How does the automatic queue loading work?
**A:** The Send node automatically loads all queues from your AWS account using the configured credentials. Simply select from the dropdown.

### Q: Can I send workflow input data directly?
**A:** Yes! Enable "Send Input Data" and the node will automatically send your workflow input data as JSON message body.

### Q: What happens if a message send fails?
**A:** The node will return an error, but you can enable "Continue on Fail" to handle this gracefully and continue processing other items.

### Q: Can I add custom message attributes?
**A:** Yes! Use the "Message Attributes" option in "Additional Options" to add custom attributes as JSON.

### Q: Is there a limit to delay seconds?
**A:** Yes, AWS SQS supports delays from 0 to 900 seconds (15 minutes).

## 🤝 Contributing

We welcome contributions! Here's how you can help:

1. 🍴 **Fork** the repository
2. 🔄 **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. 📝 **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. 🚀 **Push** to the branch (`git push origin feature/amazing-feature`)
5. 🔍 **Open** a Pull Request

### Bug Reports

Found a bug? Please [create an issue](https://github.com/adejaimejr/n8n-nodes-sqs-pro/issues) with:

- Detailed description
- Steps to reproduce
- Expected vs actual behavior
- n8n and node versions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to the [n8n team](https://n8n.io) for creating an amazing platform
- Thanks to the n8n community for their support and feedback
- Inspired by the need for efficient SQS message management

## 📊 Stats

![GitHub stars](https://img.shields.io/github/stars/adejaimejr/n8n-nodes-sqs-pro?style=social)
![GitHub forks](https://img.shields.io/github/forks/adejaimejr/n8n-nodes-sqs-pro?style=social)

---

<div align="center">
  <strong>Made with ❤️ by <a href="https://github.com/adejaimejr">Adejaime Junior</a></strong>
</div>

<div align="center">
  <strong>🚀 Star this project if you found it helpful!</strong>
</div>
