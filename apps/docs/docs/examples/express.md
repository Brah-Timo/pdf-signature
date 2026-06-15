---
id: examples/express
title: Express Integration
sidebar_label: Express
slug: /examples/express
---

# Express Integration

```typescript title="routes/contracts.ts"
import express from 'express';
import { pdfSign, pdfVerify } from 'pdf-signature';
import multer from 'multer';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// POST /contracts/:id/send — send a contract for signature
router.post('/:id/send', async (req, res) => {
  const { signerEmail, signerName, message } = req.body;

  const result = await pdfSign(`./storage/${req.params.id}.pdf`, {
    signer:     signerEmail,
    signerName,
    message,
    legal:      'eIDAS',
    webhookUrl: `${process.env.APP_URL}/webhooks/signed`,
    metadata:   { contractId: req.params.id },
  });

  await db.contracts.findByIdAndUpdate(req.params.id, {
    signatureId: result.signatureId,
    status:      'pending',
  });

  res.json({ success: true, signingUrl: result.signingUrl });
});

// POST /contracts/upload-and-sign — upload + sign in one step
router.post('/upload-and-sign', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const result = await pdfSign(req.file.buffer, {
    signer: req.body.signerEmail,
    legal:  'eIDAS',
  });

  res.json(result);
});

// GET /contracts/:signatureId/verify
router.get('/:signatureId/verify', async (req, res) => {
  const verification = await pdfVerify({ signatureId: req.params.signatureId });
  res.json(verification);
});

export default router;
```
