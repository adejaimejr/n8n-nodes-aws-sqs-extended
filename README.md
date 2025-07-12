# AWS SQS Pro - n8n Community Node

<div align="center">
  <img src="https://github.com/adejaimejr/n8n-nodes-sqs-pro/raw/main/assets/automate-without-limits.png" alt="Automate without limits" width="600" />
</div>

<br />

[![npm version](https://img.shields.io/npm/v/n8n-nodes-sqs-pro)](https://www.npmjs.com/package/n8n-nodes-sqs-pro)
[![license](https://img.shields.io/npm/l/n8n-nodes-sqs-pro)](https://github.com/adejaimejr/n8n-nodes-sqs-pro/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/n8n-nodes-sqs-pro)](https://www.npmjs.com/package/n8n-nodes-sqs-pro)
[![n8n-community-node](https://img.shields.io/badge/n8n-community%20node-blueviolet)](https://n8n.io/integrations/community-nodes/)

> 🎯 **Professional AWS SQS Delete node for n8n** - Simple, powerful and efficient message deletion from SQS queues

## ✨ Features

- 🗑️ **Message Deletion** - Delete messages from SQS queues efficiently
- 🔄 **Batch Processing** - Process multiple messages in a single workflow
- 🛡️ **Error Handling** - Robust error handling with continue-on-fail support
- 🔐 **Native AWS Credentials** - Uses n8n's built-in AWS credentials
- 📊 **Detailed Logging** - Comprehensive logging with request IDs and timestamps
- 🎯 **FIFO & Standard Queues** - Compatible with all SQS queue types
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

### 2. Add the Node to Your Workflow

1. Create a new workflow
2. Add the **AWS SQS Delete** node
3. Configure the parameters:
   - **Queue URL**: Full SQS queue URL
   - **Receipt Handle**: Message receipt handle to delete

### 3. Execute the Workflow

The node will delete the specified message from your SQS queue and return a success response.

## 📋 Operations

### Delete Message

Deletes a single message from an SQS queue.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| Queue URL | string | ✅ | The full URL of the SQS queue |
| Receipt Handle | string | ✅ | The receipt handle of the message to delete |

**Example Configuration:**

```json
{
  "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue.fifo",
  "receiptHandle": "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a..."
}
```

## 💡 Use Cases

### 1. Process and Delete Messages

```json
{
  "nodes": [
    {
      "name": "SQS Trigger",
      "type": "n8n-nodes-aws-sqs-trigger",
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
      "type": "n8n-nodes-sqs-pro",
      "parameters": {
        "queueUrl": "{{$node['SQS Trigger'].json.queueUrl}}",
        "receiptHandle": "{{$node['SQS Trigger'].json.receiptHandle}}"
      }
    }
  ]
}
```

### 2. Batch Message Processing

Process multiple messages from different queues in a single workflow:

```json
{
  "items": [
    {
      "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/queue1",
      "receiptHandle": "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a..."
    },
    {
      "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/queue2", 
      "receiptHandle": "AQEBxMpLyrHigUMZj6rYigCgxlaS3SLy0b..."
    }
  ]
}
```

### 3. Error Handling

Configure the node to continue on failure:

```json
{
  "continueOnFail": true,
  "parameters": {
    "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
    "receiptHandle": "invalid-handle"
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
        "sqs:DeleteMessage"
      ],
      "Resource": "arn:aws:sqs:*:*:*"
    }
  ]
}
```

## 📊 Output

The node returns the following data for each processed message:

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

In case of error (with continue-on-fail enabled):

```json
{
  "success": false,
  "error": "The receipt handle provided is not valid",
  "operation": "deleteMessage",
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
│   └── AwsSqsDelete/
│       ├── AwsSqsDelete.node.ts    # Main node implementation
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
**A:** Yes! This node works with both Standard and FIFO SQS queues.

### Q: What happens if the message is already deleted?
**A:** The node will return an error, but you can enable "Continue on Fail" to handle this gracefully.

### Q: Can I delete multiple messages at once?
**A:** Yes, you can process multiple items in a single workflow execution. Each item should have its own `queueUrl` and `receiptHandle`.

### Q: Do I need to configure AWS credentials?
**A:** Yes, you need to configure AWS credentials in n8n's credential manager. The node uses n8n's native AWS credentials.

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
