# pdf-signature ✍️

> Legal PDF e-signatures in one line of code. eIDAS & KSA compliant.

[![npm version](https://badge.fury.io/js/pdf-signature.svg)](https://www.npmjs.com/package/pdf-signature)
[![Downloads](https://img.shields.io/npm/dm/pdf-signature)](https://www.npmjs.com/package/pdf-signature)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![eIDAS Compliant](https://img.shields.io/badge/eIDAS-Compliant-blue)](https://pdf-signature.dev/legal)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3%2B-blue)](https://www.typescriptlang.org/)

## Why pdf-signature?

| Feature | DocuSign | HelloSign | pdf-signature |
|---------|----------|-----------|---------------|
| Price | $40+/month | $20+/month | Free + $22/month Pro |
| Setup | Dashboard + complex API | Dashboard + API | **One line of code** |
| eIDAS EU | ✅ | ✅ | ✅ |
| KSA-ETL | ✅ | ❌ | ✅ |
| TypeScript | Partial | Partial | **Full** |
| Webhook | ✅ | ✅ | ✅ |
| Open Source Core | ❌ | ❌ | ✅ |
| Sequential Multi-sign | ✅ | ✅ | ✅ |
| PKCS#7 / AdES | ✅ | ❌ | ✅ |

## Installation

```bash
npm install pdf-signature
# or
pnpm add pdf-signature
# or
yarn add pdf-signature
```

## Quick Start

```typescript
import { pdfSign } from 'pdf-signature';

// Set your API key once (or use the configure() function)
process.env.PDF_SIGN_API_KEY = 'pdf_live_your_key_here';

// Send a contract for signature — that's it!
const result = await pdfSign('contract.pdf', {
  signer: 'ali@company.com',
  legal: 'eIDAS',
});

console.log(`Signing URL: ${result.signingUrl}`);
// → https://sign.pdf-signature.dev/s/eyJhb...
// The signer also receives this link automatically by email.
```

## Get Your API Key

1. Sign up at [pdf-signature.dev](https://pdf-signature.dev) — takes 30 seconds
2. Copy your API key from the dashboard
3. Set it as an environment variable:
   ```
   PDF_SIGN_API_KEY=pdf_live_xxxxxxxxxxxxxxxxxxxx
   ```

**Free plan**: 20 signatures/month — no credit card required.

## API Reference

### `pdfSign(file, options)` — Send for Signature

```typescript
import { pdfSign } from 'pdf-signature';

// Full example with all options
const result = await pdfSign('./contracts/employment.pdf', {
  // Required
  signer: 'ali@email.com',

  // Optional
  signerName: 'Ali Al-Ghamdi',
  legal: 'eIDAS',                    // 'eIDAS' | 'ESIGN' | 'UETA' | 'KSA-ETL'
  message: 'Please review and sign.',
  expiresIn: 48,                     // hours (default: 72)
  webhookUrl: 'https://myapp.com/webhooks/signed',
  signatureLevel: 'AdES-B-LT',       // 'basic' | 'AdES-B' | 'AdES-B-T' | 'AdES-B-LT'
  signaturePosition: {
    page: 1,
    x: 400,
    y: 100,
    width: 200,
    height: 60,
  },
  metadata: {
    contractId: 'CNT-2025-042',
    department: 'Legal',
  },
  smsNotify: '+966501234567',         // Pro plan
  locale: 'ar',                       // 'en' | 'ar' | 'fr' | 'de' | 'es'
});

// Result
console.log(result.signatureId);     // 'sig_8f3a9c2d1e4b7a6f'
console.log(result.signingUrl);      // URL to send to the signer
console.log(result.expiresAt);       // ISO 8601 expiry
console.log(result.auditTrailId);    // For compliance records
```

### `pdfVerify(file)` — Verify a Signed Document

```typescript
import { pdfVerify } from 'pdf-signature';

// Verify a local signed PDF
const result = await pdfVerify('./signed-contract.pdf');

// Verify by signature ID
const result = await pdfVerify({ signatureId: 'sig_8f3a9c2d1e4b7a6f' });

console.log(result.valid);            // true
console.log(result.legallyBinding);   // true
console.log(result.signatures[0].integrityCheck); // 'PASSED'
console.log(result.complianceReport); // URL to PDF compliance report
```

### `pdfMultiSign(file, options)` — Sequential Multi-Party Signing

```typescript
import { pdfMultiSign, getMultiSignStatus } from 'pdf-signature';

// Collect signatures from multiple parties in sequence
const session = await pdfMultiSign('partnership.pdf', {
  signers: [
    {
      email: 'ali@company.com',
      name: 'Ali Al-Ghamdi',
      order: 1,
      role: 'Party A',
      signaturePosition: { page: 5, x: 100, y: 200, width: 180, height: 50 },
    },
    {
      email: 'sara@partner.com',
      name: 'Sara Al-Shehri',
      order: 2,
      role: 'Party B',
      signaturePosition: { page: 5, x: 350, y: 200, width: 180, height: 50 },
    },
    {
      email: 'ceo@company.com',
      order: 3,
      role: 'Witness',
    },
  ],
  legal: 'eIDAS',
  webhookUrl: 'https://myapp.com/webhooks/contract-signed',
  notifyAllOnComplete: true,
});

console.log(session.sessionId);        // 'msign_a1b2c3d4...'
console.log(session.nextSignerEmail);  // 'ali@company.com' (first to sign)

// Check status later
const status = await getMultiSignStatus(session.sessionId);
console.log(`${status.completedCount}/${status.totalCount} signed`);
```

### `configure(options)` — Explicit SDK Configuration

```typescript
import { configure } from 'pdf-signature';

// Call this once at application startup instead of using env vars
configure({
  apiKey: process.env.PDF_SIGN_API_KEY!,
  apiBaseUrl: 'https://api.pdf-signature.dev', // optional
  timeout: 30_000,                              // optional, ms
  retryAttempts: 3,                             // optional
  debug: true,                                  // optional, log HTTP calls
});
```

## Error Handling

All errors extend `PdfSignatureError` and have a `code` property:

```typescript
import {
  pdfSign,
  PdfSignatureError,
  QuotaExceededError,
  AuthenticationError,
  ValidationError,
  RateLimitError,
} from 'pdf-signature';

try {
  const result = await pdfSign('contract.pdf', { signer: 'ali@email.com' });
} catch (error) {
  if (error instanceof QuotaExceededError) {
    // Free plan limit reached — prompt user to upgrade
    console.log('Upgrade to Pro: https://pdf-signature.dev/pricing');
  } else if (error instanceof AuthenticationError) {
    // Check your API key
    console.error('Invalid API key');
  } else if (error instanceof ValidationError) {
    console.error('Invalid options:', error.message, 'Field:', error.field);
  } else if (error instanceof RateLimitError) {
    console.error(`Rate limited. Retry in ${error.retryAfterSeconds}s`);
  } else if (error instanceof PdfSignatureError) {
    console.error(`API error [${error.code}]:`, error.message);
  }
}
```

## Webhook Verification

Verify that webhook calls are genuinely from pdf-signature:

```typescript
import { createHmac } from 'crypto';
import type { WebhookPayload } from 'pdf-signature';

// Express.js example
app.post('/webhooks/signed', express.raw({ type: 'application/json' }), (req, res) => {
  const { signature, ...payload } = JSON.parse(req.body) as WebhookPayload;
  const secret = process.env.PDF_SIGN_WEBHOOK_SECRET!;

  // Verify HMAC-SHA256 signature
  const expected = `sha256=${createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')}`;

  if (signature !== expected) {
    return res.status(401).send('Invalid webhook signature');
  }

  // Handle events
  switch (payload.event) {
    case 'signature.completed':
      await db.contracts.update({ id: payload.data.signatureId, status: 'signed' });
      break;
    case 'signature.declined':
      await notifyTeam(`${payload.data.signerName} declined to sign`);
      break;
    case 'multisign.all_completed':
      await finalizeContract(payload.signatureId);
      break;
  }

  res.status(200).send('OK');
});
```

## Legal Compliance

### eIDAS (EU) — Advanced Electronic Signature (AdES)
- **Standard**: EU Regulation 910/2014, Article 26
- **Level**: AdES-B-T (with trusted timestamp) or AdES-B-LT (full chain)
- **Legally binding in**: 27 EU member states + United Kingdom
- **Certificate**: X.509 v3 with signing and non-repudiation key usage

### KSA-ETL (Saudi Arabia)
- **Standard**: Electronic Transactions Law, Royal Decree m/18 (2007), Article 5
- **Enforced by**: SDAIA / CITC
- **Requirement met**: Digital signature based on X.509 certificate from recognized CA

### US ESIGN / UETA
- **Standard**: Electronic Signatures in Global and National Commerce Act (2000)
- **Requirement met**: Signer intent captured, email authentication, audit trail

## Requirements

- **Node.js** >= 18.0.0
- **API key** from [pdf-signature.dev](https://pdf-signature.dev)

## License

MIT — see [LICENSE](LICENSE)

---

Built with ❤️ for developers who want legal e-signatures without the enterprise complexity.

[Documentation](https://docs.pdf-signature.dev) · [Dashboard](https://app.pdf-signature.dev) · [GitHub](https://github.com/pdf-signature/pdf-signature) · [npm](https://www.npmjs.com/package/pdf-signature)
