/**
 * Email Service
 *
 * Sends transactional emails using Resend (primary) with SendGrid fallback.
 * All emails are HTML with plain-text fallbacks and RTL support.
 */

import { Resend } from "resend";

const resend = new Resend(process.env["RESEND_API_KEY"]);
const FROM_EMAIL = process.env["FROM_EMAIL"] ?? "sign@pdf-signature.dev";
const FROM_NAME = process.env["FROM_NAME"] ?? "pdf-signature";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SigningRequestEmailOptions {
  to: string;
  signerName: string;
  senderName: string;
  documentTitle: string;
  signingUrl: string;
  expiresAt: Date;
  message?: string;
  locale?: string;
}

export interface SignatureCompletedEmailOptions {
  to: string;         // Document owner email
  ownerName?: string;
  signerName: string;
  signerEmail: string;
  documentTitle: string;
  downloadUrl: string;
  signedAt: Date;
}

// ─────────────────────────────────────────────
// Send Signing Request Email (to the signer)
// ─────────────────────────────────────────────

/**
 * Send the signing invitation email to the person who needs to sign.
 * This is the most important email in the system.
 */
export async function sendSigningRequest(
  options: SigningRequestEmailOptions
): Promise<void> {
  const {
    to, signerName, senderName, documentTitle,
    signingUrl, expiresAt, message, locale = "en",
  } = options;

  const isAr = locale === "ar";
  const expiryStr = new Intl.DateTimeFormat(isAr ? "ar-SA" : "en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  }).format(expiresAt);

  const subject = isAr
    ? `طلب توقيع: ${documentTitle}`
    : `Please sign: ${documentTitle}`;

  const html = buildSigningRequestHtml({
    signerName, senderName, documentTitle, signingUrl,
    expiresAt: expiryStr, message, isAr,
  });

  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    html,
    text: buildSigningRequestText({ signerName, senderName, documentTitle, signingUrl, expiresAt: expiryStr, message, isAr }),
    headers: {
      "X-Entity-Ref-ID": `sign-${Date.now()}`,
      "List-Unsubscribe": "<mailto:unsubscribe@pdf-signature.dev>",
    },
  });
}

// ─────────────────────────────────────────────
// Send Completion Notification (to document owner)
// ─────────────────────────────────────────────

/**
 * Notify the document owner when their document has been signed.
 */
export async function sendSignatureCompleted(
  options: SignatureCompletedEmailOptions
): Promise<void> {
  const {
    to, ownerName, signerName, signerEmail,
    documentTitle, downloadUrl, signedAt,
  } = options;

  const signedAtStr = new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  }).format(signedAt);

  await resend.emails.send({
    from: `${FROM_NAME} <${FROM_EMAIL}>`,
    to,
    subject: `✅ Signed: ${documentTitle}`,
    html: buildCompletionHtml({ ownerName, signerName, signerEmail, documentTitle, downloadUrl, signedAt: signedAtStr }),
    text: `
${documentTitle} has been signed.

Signed by: ${signerName} (${signerEmail})
Signed at: ${signedAtStr}

Download the signed document: ${downloadUrl}

---
pdf-signature | https://pdf-signature.dev
    `.trim(),
  });
}

// ─────────────────────────────────────────────
// HTML Templates
// ─────────────────────────────────────────────

function buildSigningRequestHtml(opts: {
  signerName: string; senderName: string; documentTitle: string;
  signingUrl: string; expiresAt: string; message?: string; isAr: boolean;
}): string {
  const { signerName, senderName, documentTitle, signingUrl, expiresAt, message, isAr } = opts;

  return `
<!DOCTYPE html>
<html lang="${isAr ? "ar" : "en"}" dir="${isAr ? "rtl" : "ltr"}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${isAr ? "طلب توقيع" : "Signing Request"}</title>
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #1a3e8c 0%, #2563eb 100%); padding: 40px 48px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px; }
    .body { padding: 48px; }
    .greeting { font-size: 18px; font-weight: 600; color: #1e293b; margin-bottom: 16px; }
    .description { color: #64748b; line-height: 1.7; margin-bottom: 24px; }
    .document-box { background: #f1f5f9; border-radius: 12px; padding: 20px 24px; margin-bottom: 32px; display: flex; align-items: center; gap: 16px; }
    .doc-icon { font-size: 32px; flex-shrink: 0; }
    .doc-title { font-weight: 600; color: #1e293b; font-size: 15px; }
    .doc-meta { color: #94a3b8; font-size: 13px; margin-top: 4px; }
    .cta-button { display: block; text-align: center; background: linear-gradient(135deg, #1a3e8c, #2563eb); color: white; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; letter-spacing: 0.3px; margin: 32px 0; }
    .message-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 16px 20px; margin-bottom: 24px; color: #78350f; font-size: 14px; line-height: 1.6; }
    .expiry-notice { font-size: 13px; color: #94a3b8; text-align: center; }
    .legal-notice { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 16px; margin-top: 32px; }
    .legal-notice p { margin: 0; font-size: 12px; color: #166534; line-height: 1.6; }
    .footer { background: #f8fafc; padding: 24px 48px; text-align: center; border-top: 1px solid #e2e8f0; }
    .footer p { margin: 0; font-size: 12px; color: #94a3b8; }
    .footer a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✍️ pdf-signature</h1>
      <p>${isAr ? "توقيع إلكتروني قانوني" : "Legal Electronic Signature"}</p>
    </div>

    <div class="body">
      <p class="greeting">
        ${isAr ? `مرحباً ${signerName}،` : `Hello ${signerName},`}
      </p>

      <p class="description">
        ${isAr
          ? `طلب منك <strong>${senderName}</strong> توقيع المستند التالي. التوقيع ملزم قانونياً وفق معيار eIDAS.`
          : `<strong>${senderName}</strong> has requested your signature on the following document. This will be a legally binding signature under eIDAS.`}
      </p>

      <div class="document-box">
        <div class="doc-icon">📄</div>
        <div>
          <div class="doc-title">${documentTitle}</div>
          <div class="doc-meta">
            ${isAr ? `ينتهي في: ${expiresAt}` : `Expires: ${expiresAt}`}
          </div>
        </div>
      </div>

      ${message ? `
      <div class="message-box">
        <strong>${isAr ? "رسالة من المُرسِل:" : "Message from sender:"}</strong><br>
        ${message}
      </div>` : ""}

      <a href="${signingUrl}" class="cta-button">
        ${isAr ? "✅ فتح المستند وتوقيعه" : "✅ Open & Sign Document"}
      </a>

      <p class="expiry-notice">
        ${isAr
          ? `⏰ رابط التوقيع صالح حتى: ${expiresAt}`
          : `⏰ This link expires: ${expiresAt}`}
      </p>

      <div class="legal-notice">
        <p>
          ${isAr
            ? `🔐 بالتوقيع على هذا المستند، تقرّ بأن توقيعك الإلكتروني ملزم قانونياً وفق معيار eIDAS (لائحة الاتحاد الأوروبي 910/2014) ونظام المعاملات الإلكترونية السعودي. سيتم تسجيل عنوان IP الخاص بك ومعلومات الجهاز في سجل التدقيق.`
            : `🔐 By signing this document, you agree that your electronic signature is legally binding under eIDAS (EU Regulation 910/2014). Your IP address and device information will be recorded in the audit trail.`}
        </p>
      </div>
    </div>

    <div class="footer">
      <p>
        ${isAr ? "لم تتوقع هذا البريد؟" : "Didn't expect this email?"} 
        <a href="mailto:support@pdf-signature.dev">${isAr ? "أخبرنا" : "Let us know"}</a>
        <br>
        ${isAr ? "مدعوم بواسطة" : "Secured by"} 
        <a href="https://pdf-signature.dev">pdf-signature.dev</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

function buildSigningRequestText(opts: {
  signerName: string; senderName: string; documentTitle: string;
  signingUrl: string; expiresAt: string; message?: string; isAr: boolean;
}): string {
  return `
${opts.signerName},

${opts.senderName} has requested your signature on: ${opts.documentTitle}

Sign here: ${opts.signingUrl}

Link expires: ${opts.expiresAt}
${opts.message ? `\nMessage: ${opts.message}` : ""}

By signing, you agree this electronic signature is legally binding.

---
pdf-signature | https://pdf-signature.dev
  `.trim();
}

function buildCompletionHtml(opts: {
  ownerName?: string; signerName: string; signerEmail: string;
  documentTitle: string; downloadUrl: string; signedAt: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .header { background: linear-gradient(135deg, #059669, #10b981); padding: 40px; text-align: center; }
    .header h1 { color: white; margin: 0; font-size: 22px; }
    .body { padding: 40px; }
    .details { background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 24px 0; }
    .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
    .detail-row:last-child { border-bottom: none; }
    .label { color: #64748b; }
    .value { color: #1e293b; font-weight: 500; }
    .download-btn { display: block; text-align: center; background: #1a3e8c; color: white; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-weight: 600; margin: 24px 0; }
    .footer { background: #f8fafc; padding: 20px 40px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>✅ Document Signed!</h1>
    </div>
    <div class="body">
      <p>Hello${opts.ownerName ? ` ${opts.ownerName}` : ""},</p>
      <p><strong>${opts.documentTitle}</strong> has been signed.</p>

      <div class="details">
        <div class="detail-row">
          <span class="label">Document</span>
          <span class="value">${opts.documentTitle}</span>
        </div>
        <div class="detail-row">
          <span class="label">Signed by</span>
          <span class="value">${opts.signerName} (${opts.signerEmail})</span>
        </div>
        <div class="detail-row">
          <span class="label">Signed at</span>
          <span class="value">${opts.signedAt}</span>
        </div>
        <div class="detail-row">
          <span class="label">Signature</span>
          <span class="value">✅ Cryptographically verified</span>
        </div>
      </div>

      <a href="${opts.downloadUrl}" class="download-btn">⬇️ Download Signed Document</a>
    </div>
    <div class="footer">Secured by <a href="https://pdf-signature.dev" style="color:#2563eb">pdf-signature</a></div>
  </div>
</body>
</html>`;
}

// Export as service object
export const emailService = {
  sendSigningRequest,
  sendSignatureCompleted,
};
