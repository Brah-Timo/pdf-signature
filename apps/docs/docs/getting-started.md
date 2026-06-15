---
id: getting-started
title: Getting Started
sidebar_label: Getting Started
slug: /getting-started
description: Install pdf-signature and send your first legally binding e-signature request in under 5 minutes.
---

# Getting Started

> Send a legally binding PDF signature request in one line of code — eIDAS & KSA compliant.

## Installation

```bash
npm install pdf-signature
# or
pnpm add pdf-signature
# or
yarn add pdf-signature
```

**Requirements:** Node.js ≥ 18.0.0

## Get your API key

1. Go to [pdf-signature.dev](https://pdf-signature.dev) and create a free account
2. Navigate to **Dashboard → API Keys**
3. Click **New API Key**, give it a name, and copy the generated key

:::warning Keep your key secret
Never expose your API key in client-side code or commit it to a public repository.
:::

## Set up environment variables

```bash title=".env"
PDF_SIGN_API_KEY=pdf_live_xxxxxxxxxxxxxxxxxxxx
```

Or set it directly in your application bootstrap:

```typescript
process.env.PDF_SIGN_API_KEY = 'pdf_live_xxxxxxxxxxxxxxxxxxxx';
```

## Your first signature request

```typescript
import { pdfSign } from 'pdf-signature';

const result = await pdfSign('contract.pdf', {
  signer: 'ali@email.com',
  legal: 'eIDAS',
});

console.log(result.signingUrl);
// → https://sign.pdf-signature.dev/s/eyJhbGciOiJ...
// The URL is automatically emailed to the signer
```

The response object:

```json
{
  "success": true,
  "signatureId": "sig_8f3a9c2d1e4b7a6f",
  "signingUrl": "https://sign.pdf-signature.dev/s/eyJhbGci...",
  "expiresAt": "2025-08-17T14:30:00.000Z",
  "status": "pending",
  "auditTrailId": "audit_5c8e2f1a9d3b4c7e"
}
```

## What happens next?

1. **pdf-signature** stores your PDF securely (AES-256 encrypted)
2. An email is sent to `ali@email.com` with the signing link
3. Ali opens the link → sees the PDF → signs with mouse, touch, or typed name
4. The signature is cryptographically embedded (PKCS#7 / X.509)
5. An RFC 3161 timestamp is added from DigiCert
6. You receive a webhook notification + the signed PDF is ready to download

## Verify a signed document

```typescript
import { pdfVerify } from 'pdf-signature';

const result = await pdfVerify('./signed-contract.pdf');

console.log(result.valid);        // true
console.log(result.legallyBinding); // true
console.log(result.signatures[0].integrityCheck); // 'PASSED'
```

## Multi-signer workflow

```typescript
import { pdfMultiSign } from 'pdf-signature';

const result = await pdfMultiSign('partnership.pdf', {
  signers: [
    { email: 'party-a@company.com', name: 'Alice',   order: 1 },
    { email: 'party-b@partner.com', name: 'Bob',     order: 2 },
    { email: 'witness@law.com',     name: 'Witness', order: 3 },
  ],
  legal: 'eIDAS',
  webhookUrl: 'https://yourapp.com/webhooks/all-signed',
});
```

Signers are notified sequentially — Party B only receives the link after Party A has signed.

## Free plan limits

| Feature | Free | Pro ($22/mo) |
|---------|------|-------------|
| Signatures/month | 20 | Unlimited |
| eIDAS compliance | Basic | AdES-B-LT |
| Multi-signer | ✗ | ✓ |
| Webhooks | ✗ | ✓ |
| Storage | 30 days | 5 years |

[Upgrade to Pro →](https://pdf-signature.dev/billing)

## Next steps

- [API Reference](/api-reference) — Full method signatures and options
- [Legal Compliance](/legal-compliance) — eIDAS, KSA-ETL, ESIGN details
- [Examples](/examples/nextjs) — Real-world integration examples
