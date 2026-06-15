---
id: examples/multi-sign
title: Multi-Signer Workflow
sidebar_label: Multi-signer
slug: /examples/multi-sign
---

# Multi-Signer Workflow

Request signatures from multiple people on the same document — in order.

## Sequential signing (default)

```typescript
import { pdfMultiSign } from 'pdf-signature';

const result = await pdfMultiSign('./partnership-agreement.pdf', {
  signers: [
    {
      email: 'alice@company.com',
      name:  'Alice Johnson',
      order: 1,
      role:  'Party A',
      signaturePosition: { page: 5, x: 80,  y: 200, width: 180, height: 50 },
    },
    {
      email: 'bob@partner.com',
      name:  'Bob Smith',
      order: 2,
      role:  'Party B',
      signaturePosition: { page: 5, x: 320, y: 200, width: 180, height: 50 },
    },
    {
      email: 'witness@lawfirm.com',
      name:  'Witness',
      order: 3,
      role:  'Witness',
      signaturePosition: { page: 5, x: 200, y: 300, width: 180, height: 50 },
    },
  ],
  legal:               'eIDAS',
  webhookUrl:          'https://yourapp.com/webhooks/all-signed',
  notifyAllOnComplete: true,
});

console.log(result.workflowId);
// Alice gets her link immediately.
// Bob's link is sent only after Alice signs.
// Witness's link is sent only after Bob signs.
```

## Handling the completion webhook

```typescript
app.post('/webhooks/all-signed', (req, res) => {
  const { event, data } = req.body;

  if (event === 'multisign.all_completed') {
    console.log(`All signers completed workflow`);
    console.log(`Download URL: ${data.downloadUrl}`);
    // Update your DB, send confirmation emails, etc.
  }

  res.json({ received: true });
});
```
