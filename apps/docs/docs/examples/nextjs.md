---
id: examples/nextjs
title: Next.js Integration
sidebar_label: Next.js
slug: /examples/nextjs
---

# Next.js Integration

Complete example for integrating pdf-signature into a Next.js 15 App Router project.

## Installation

```bash
pnpm add pdf-signature
```

```bash title=".env.local"
PDF_SIGN_API_KEY=pdf_live_xxxxxxxxxxxxxxxxxxxx
PDF_SIGN_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxx
```

## Server Action — send for signature

```typescript title="app/contracts/actions.ts"
'use server';

import { pdfSign } from 'pdf-signature';
import { readFile } from 'fs/promises';
import { redirect } from 'next/navigation';

export async function sendForSignature(contractId: string, signerEmail: string) {
  const pdfBuffer = await readFile(`/storage/contracts/${contractId}.pdf`);

  const result = await pdfSign(pdfBuffer, {
    signer:     signerEmail,
    legal:      'eIDAS',
    expiresIn:  72,
    webhookUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/signed`,
    metadata:   { contractId },
  });

  // Save to your database
  await db.contracts.update({ id: contractId }, {
    signatureId: result.signatureId,
    status:      'pending',
  });

  return { signingUrl: result.signingUrl };
}
```

## API Route — handle webhook

```typescript title="app/api/webhooks/signed/route.ts"
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const { signature, ...payload } = JSON.parse(body);

  // Verify HMAC
  const hmac = crypto.createHmac('sha256', process.env.PDF_SIGN_WEBHOOK_SECRET!);
  hmac.update(body.replace(`,"signature":"${signature}"`, ''));
  const expected = `sha256=${hmac.digest('hex')}`;

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (payload.event === 'signature.completed') {
    await db.contracts.update(
      { signatureId: payload.signatureId },
      { status: 'signed', signedAt: payload.data.signedAt },
    );
  }

  return NextResponse.json({ received: true });
}
```

## UI Component — send button

```tsx title="components/SendForSignatureButton.tsx"
'use client';

import { useState, useTransition } from 'react';
import { sendForSignature } from '@/app/contracts/actions';

export function SendForSignatureButton({
  contractId,
  signerEmail,
}: {
  contractId: string;
  signerEmail: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  return (
    <button
      disabled={isPending || sent}
      onClick={() =>
        startTransition(async () => {
          await sendForSignature(contractId, signerEmail);
          setSent(true);
        })
      }
      className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
    >
      {isPending ? 'Sending…' : sent ? '✓ Sent for signature' : 'Send for signature'}
    </button>
  );
}
```
