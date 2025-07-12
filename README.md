# n8n-nodes-aws-sqs-extended

![n8n AWS SQS Integration](https://raw.githubusercontent.com/adejaimejr/n8n-nodes-aws-sqs-extended/main/assets/automate-without-limits.png)

**🔧 Extended AWS SQS operations for n8n - Delete Messages, Queue Monitoring & Batch Operations**

[![npm version](https://img.shields.io/npm/v/n8n-nodes-aws-sqs-extended)](https://www.npmjs.com/package/n8n-nodes-aws-sqs-extended)
[![license](https://img.shields.io/npm/l/n8n-nodes-aws-sqs-extended)](https://github.com/adejaimejr/n8n-nodes-aws-sqs-extended/blob/main/LICENSE)
[![downloads](https://img.shields.io/npm/dm/n8n-nodes-aws-sqs-extended)](https://www.npmjs.com/package/n8n-nodes-aws-sqs-extended)
[![n8n-community-node](https://img.shields.io/badge/n8n-community%20node-blueviolet)](https://n8n.io/integrations/community-nodes/)

Extended AWS SQS functionality for n8n that complements the native AWS SQS node with additional operations like Delete Messages and Queue Monitoring.

## Features

- **Delete Messages**: Remove messages from SQS queues after processing
- **Queue Monitoring**: Advanced trigger with customizable polling intervals  
- **Message Receipts**: Handle message receipts and acknowledgments
- **Production Ready**: Optimized for production workloads
- **Native Integration**: Works alongside n8n's built-in AWS SQS Send node

## Installation

### Via n8n Community Nodes (Recommended)

1. Go to **Settings** → **Community Nodes** in your n8n instance
2. Click **Install** and enter: `n8n-nodes-aws-sqs-extended`
3. Click **Install** and wait for the installation to complete

### Via npm

```bash
npm install n8n-nodes-aws-sqs-extended
```

## Requirements

- n8n version 0.198.0 or higher
- Node.js 16.0.0 or higher
- AWS account with SQS access

## Quick Start

### AWS Credentials Setup

1. Go to **Settings** → **Credentials** in n8n
2. Click **Add Credential** and select **AWS**
3. Configure your AWS credentials:
   - **Access Key ID**: Your AWS access key
   - **Secret Access Key**: Your AWS secret key
   - **Region**: Your AWS region (e.g., `us-east-1`)

### Basic Usage

#### Deleting Messages

```json
{
  "queueUrl": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
  "receiptHandle": "AQEBwJnKyrHigUMZj6rYigCgxlaS3SLy0a..."
}
```

#### Monitoring Queues

```json
{
  "queue": "https://sqs.us-east-1.amazonaws.com/123456789012/my-queue",
  "interval": 30,
  "unit": "seconds",
  "deleteMessages": false,
  "visibilityTimeout": 30,
  "maxMessages": 1,
  "waitTimeSeconds": 20
}
```

## Available Nodes

### AWS SQS Delete

Delete messages from SQS queues after processing.

**Key Parameters:**
- Queue URL (full SQS queue URL)
- Receipt Handle (from received message)

### AWS SQS Trigger

Monitor SQS queues and trigger workflows when messages arrive.

**Key Parameters:**
- **Queue Selection**: Auto-loads available queues from your AWS account
- **Polling Interval**: Configurable interval (seconds/minutes)
- **Delete Messages**: Disabled by default (safe monitoring)
- **Visibility Timeout**: 30 seconds (message lock duration)
- **Max Messages**: 1 message per poll (adjustable 1-10)
- **Wait Time Seconds**: 20 seconds long polling (reduces API calls)

## Use Cases

### Message Processing Workflow

```json
{
  "nodes": [
    {
      "name": "Receive Message",
      "type": "n8n-nodes-base.awsSqs"
    },
    {
      "name": "Process Message", 
      "type": "n8n-nodes-base.function"
    },
    {
      "name": "Delete Message",
      "type": "n8n-nodes-aws-sqs-extended.awsSqsExtendedDelete",
      "parameters": {
        "queueUrl": "{{$node['Receive Message'].json.queueUrl}}",
        "receiptHandle": "{{$node['Receive Message'].json.receiptHandle}}"
      }
    }
  ]
}
```

## AWS IAM Permissions

Your AWS user needs the following permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "sqs:DeleteMessage", 
        "sqs:ReceiveMessage",
        "sqs:ListQueues",
        "sqs:GetQueueAttributes"
      ],
      "Resource": "arn:aws:sqs:*:*:*"
    }
  ]
}
```

## Configuration

### Understanding Wait Time Seconds

**Wait Time Seconds** é um parâmetro do AWS SQS que controla o **long polling**:

- **0 segundos**: **Short polling** - Retorna imediatamente (pode retornar vazio mesmo tendo mensagens)
- **1-20 segundos**: **Long polling** - Aguarda até X segundos por mensagens antes de retornar
- **Recomendado**: **20 segundos** - Máxima eficiência e redução de custos

**Benefícios do Long Polling:**
- ✅ Reduz número de chamadas API (menor custo)
- ✅ Reduz latência na detecção de mensagens
- ✅ Evita "empty receives" desnecessários
- ✅ Melhor eficiência de recursos

**Quando usar Short Polling (0s):**
- ❌ Apenas se precisar de resposta imediata
- ❌ Resulta em mais chamadas API e maior custo

### Error Handling

All nodes support n8n's standard error handling:
- Enable "Continue on Fail" to handle errors gracefully
- Use error outputs to build robust workflows
- Monitor execution logs for troubleshooting

## Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/adejaimejr/n8n-nodes-aws-sqs-extended.git

# Install dependencies
npm install

# Build the project
npm run build

# Run tests
npm test
```

### Project Structure

```
n8n-nodes-aws-sqs-extended/
├── nodes/
│   ├── AwsSqsDelete/
│   └── AwsSqsTrigger/
├── dist/
├── package.json
└── README.md
```

## Resources

- [AWS SQS Documentation](https://docs.aws.amazon.com/sqs/)
- [n8n Community Nodes](https://n8n.io/integrations/community-nodes/)
- [n8n Documentation](https://docs.n8n.io/)
- [Community Forum](https://community.n8n.io/)

## Support

Need help? Join our community:

- [GitHub Issues](https://github.com/adejaimejr/n8n-nodes-aws-sqs-extended/issues)
- [n8n Community Forum](https://community.n8n.io/)

## FAQ

**Q: Can I use this with FIFO queues?**  
A: Yes, all nodes work with both Standard and FIFO SQS queues.

**Q: How does this differ from the native AWS SQS node?**  
A: This package provides extended functionality (Delete, Monitor) that complements the native Send Message functionality.

**Q: What happens if a message operation fails?**  
A: The node will return an error, but you can enable "Continue on Fail" to handle this gracefully.

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

Found a bug 🐛 or have a feature idea? [Create an issue](https://github.com/adejaimejr/n8n-nodes-aws-sqs-extended/issues).

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## About

Created by [Adejaime Junior](https://github.com/adejaimejr) for the [n8n community](https://community.n8n.io/).

![GitHub stars](https://img.shields.io/github/stars/adejaimejr/n8n-nodes-aws-sqs-extended?style=social)
![GitHub forks](https://img.shields.io/github/forks/adejaimejr/n8n-nodes-aws-sqs-extended?style=social)
