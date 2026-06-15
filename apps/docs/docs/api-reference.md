---
id: api-reference
title: API Reference
sidebar_label: API Reference
slug: /api-reference
description: Complete reference for all pdf-signature SDK functions — pdfSign, pdfVerify, pdfMultiSign.
---

# API Reference

## `pdfSign(input, options)`

Send a PDF for electronic signature.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | `string \| Buffer \| ReadableStream` | ✓ | File path, Buffer, or stream |
| `options.signer` | `string` | ✓ | Signer's email address |
| `options.signerName` | `string` | — | Display name shown on signing page |
| `options.legal` | `'eIDAS' \| 'ESIGN' \| 'UETA' \| 'KSA-ETL'` | — | Legal standard (default: `'eIDAS'`) |
| `options.signingOrder` | `number` | — | Order in multi-signer sequence |
| `options.message` | `string` | — | Custom message in the email invitation |
| `options.expiresIn` | `number` | — | Hours until link expires (default: `72`) |
| `options.webhookUrl` | `string` | — | URL to POST when signature completes |
| `options.signaturePosition` | `SignaturePosition` | — | Visual position on page |
| `options.metadata` | `Record<string, string>` | — | Extra data stored in audit trail |
| `options.signatureLevel` | `'basic' \| 'AdES-B' \| 'AdES-B-T' \| 'AdES-B-LT'` | — | Cryptographic level (default: `'AdES-B-LT'`) |
| `options.smsNotify` | `string` | — | E.164 phone number for SMS notification |

### SignaturePosition type

```typescript
interface SignaturePosition {
  page:   number;  // Page number (1-indexed)
  x:      number;  // X coordinate in PDF points
  y:      number;  // Y coordinate in PDF points
  width:  number;  // Width in PDF points (default: 200)
  height: number;  // Height in PDF points (default: 60)
}
```

### Return value

```typescript
interface SignResult {
  success:      boolean;
  signatureId:  string;   // e.g. "sig_8f3a9c2d1e4b7a6f"
  signingUrl:   string;   // URL emailed to signer
  expiresAt:    string;   // ISO 8601
  status:       'pending';
  auditTrailId: string;
}
```

### Examples

```typescript
// Minimal — send contract to signer
const result = await pdfSign('contract.pdf', {
  signer: 'ali@email.com',
});

// Full options
const result = await pdfSign('./nda.pdf', {
  signer:      'sara@company.com',
  signerName:  'Sara Al-Shehri',
  legal:       'KSA-ETL',
  expiresIn:   48,
  message:     'Please sign this NDA before our meeting on Friday.',
  webhookUrl:  'https://yourapp.com/api/webhooks/signed',
  signaturePosition: { page: 3, x: 350, y: 80, width: 200, height: 60 },
  metadata:    { contractId: 'NDA-2025-042', department: 'Legal' },
});
```

---

## `pdfVerify(input)`

Cryptographically verify a signed PDF.

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `input` | `string \| Buffer \| { signatureId: string }` | Signed PDF path, Buffer, or signature ID |

### Return value

```typescript
interface VerifyResult {
  valid:          boolean;
  legallyBinding: boolean;
  documentHash:   string;
  signatures: Array<{
    signerEmail:         string;
    signerName:          string | null;
    signedAt:            string;
    ipAddress:           string;
    userAgent:           string;
    legalStandard:       string;
    certificateSerial:   string;
    timestampAuthority:  string;
    integrityCheck:      'PASSED' | 'FAILED';
    level:               string;
  }>;
  complianceReport: string;  // URL to downloadable PDF report
}
```

### Examples

```typescript
// Verify by file path
const result = await pdfVerify('./signed-contract.pdf');

// Verify by signature ID (when you don't have the file locally)
const result = await pdfVerify({ signatureId: 'sig_8f3a9c2d1e4b7a6f' });

if (!result.valid) {
  console.error('Signature invalid or document tampered!');
}
```

---

## `pdfMultiSign(input, options)`

Send a document to multiple signers (sequential by default).

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | `string \| Buffer` | ✓ | PDF file path or Buffer |
| `options.signers` | `Signer[]` | ✓ | Array of signer objects |
| `options.legal` | `string` | — | Legal standard applied to all signers |
| `options.webhookUrl` | `string` | — | Called when ALL signers complete |
| `options.notifyAllOnComplete` | `boolean` | — | Email all parties when complete |

### Signer type

```typescript
interface Signer {
  email:              string;   // Required
  name?:              string;   // Display name
  order:              number;   // 1 = first to sign
  role?:              string;   // Label shown on document (e.g. "Party A")
  message?:           string;   // Custom email message for this signer
  signaturePosition?: SignaturePosition;
}
```

### Return value

```typescript
interface MultiSignResult {
  success:      boolean;
  workflowId:   string;
  signers: Array<{
    email:      string;
    order:      number;
    status:     'waiting' | 'notified' | 'signed';
    signingUrl: string | null;  // null if not yet their turn
  }>;
}
```

---

## Webhook Events

Configure `webhookUrl` to receive POST requests when signature events occur.

### Event types

| Event | Description |
|-------|-------------|
| `signature.completed` | Signer signed the document |
| `signature.declined` | Signer declined to sign |
| `signature.expired` | Signing link expired |
| `signature.viewed` | Signer opened the link |
| `multisign.all_completed` | All signers in workflow completed |

### Payload

```typescript
interface WebhookPayload {
  event:       string;
  signatureId: string;
  timestamp:   string;
  data: {
    signerEmail:   string;
    signerName?:   string;
    downloadUrl?:  string;   // Only on 'completed'
    legalStandard: string;
    signedAt?:     string;
  };
  signature: string;  // HMAC-SHA256 for verification
}
```

### Verifying webhook authenticity

```typescript
import crypto from 'crypto';

app.post('/webhooks/pdf-signed', (req, res) => {
  const { signature, ...payload } = req.body;

  const hmac = crypto.createHmac('sha256', process.env.PDF_SIGN_WEBHOOK_SECRET!);
  hmac.update(JSON.stringify(payload));
  const expected = `sha256=${hmac.digest('hex')}`;

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Safe to process
  if (payload.event === 'signature.completed') {
    await db.contracts.update({ id: payload.signatureId }, { status: 'signed' });
  }

  res.status(200).json({ received: true });
});
```

---

## Error handling

All functions throw a `PdfSignError` on failure:

```typescript
import { pdfSign, PdfSignError } from 'pdf-signature';

try {
  const result = await pdfSign('contract.pdf', { signer: 'ali@email.com' });
} catch (err) {
  if (err instanceof PdfSignError) {
    console.error(err.code);    // 'QUOTA_EXCEEDED', 'INVALID_EMAIL', etc.
    console.error(err.message); // Human-readable message
    console.error(err.statusCode); // HTTP status from API
  }
}
```

### Error codes

| Code | Description |
|------|-------------|
| `QUOTA_EXCEEDED` | Free plan limit reached (20/month) |
| `INVALID_EMAIL` | Signer email is not valid |
| `FILE_NOT_FOUND` | Input file path does not exist |
| `FILE_TOO_LARGE` | PDF exceeds 50 MB limit |
| `INVALID_API_KEY` | API key is missing or invalid |
| `SIGNATURE_EXPIRED` | Signing link has expired |
| `NETWORK_ERROR` | Could not reach the pdf-signature API |
