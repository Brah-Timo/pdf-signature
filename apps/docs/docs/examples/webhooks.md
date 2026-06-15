---
id: examples/webhooks
title: Webhooks
sidebar_label: Webhooks
slug: /examples/webhooks
---

# Webhook Reference

pdf-signature sends HMAC-signed webhook POST requests when signature events occur.

## Supported events

| Event | Trigger |
|-------|---------|
| `signature.completed` | Signer clicked "Confirm Signature" |
| `signature.declined` | Signer clicked "Decline" |
| `signature.expired` | Link expired without being signed |
| `signature.viewed` | Signer opened the signing link |
| `multisign.all_completed` | Every signer in a workflow has signed |

## Example handler (Express)

```typescript
import express from 'express';
import crypto from 'crypto';

const app = express();
app.use(express.text({ type: 'application/json' }));

app.post('/webhooks/pdf-signature', (req, res) => {
  const rawBody = req.body;
  const payload = JSON.parse(rawBody);
  const { signature } = payload;

  // Verify HMAC-SHA256
  const bodyWithoutSig = rawBody.replace(`,"signature":"${signature}"`, '');
  const hmac = crypto.createHmac('sha256', process.env.PDF_SIGN_WEBHOOK_SECRET!);
  hmac.update(bodyWithoutSig);
  const expected = `sha256=${hmac.digest('hex')}`;

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  switch (payload.event) {
    case 'signature.completed':
      console.log(`✅ Signed by ${payload.data.signerEmail}`);
      console.log(`📥 Download: ${payload.data.downloadUrl}`);
      break;

    case 'signature.declined':
      console.log(`❌ Declined by ${payload.data.signerEmail}`);
      break;

    case 'signature.expired':
      console.log(`⏰ Expired: ${payload.signatureId}`);
      break;
  }

  res.status(200).json({ received: true });
});
```

## Retry policy

If your endpoint returns a non-2xx response, pdf-signature retries up to **3 times**:

| Attempt | Delay |
|---------|-------|
| 1st retry | 1 second |
| 2nd retry | 2 seconds |
| 3rd retry | 4 seconds |

After 3 failed attempts, the webhook is marked as `FAILED` and visible in your dashboard.
