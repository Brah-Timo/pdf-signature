/**
 * @pdf-signature/pdf — PDF Writer / Signing Orchestrator
 *
 * Orchestrates the complete PDF signing pipeline:
 * 1. Validate input PDF
 * 2. Inject signature placeholder
 * 3. Compute byte-range hash
 * 4. Build PKCS#7 signature (delegates to @pdf-signature/crypto)
 * 5. Inject signature into placeholder
 * 6. Render visual signature on page
 * 7. Return finalized signed PDF
 *
 * This module is the bridge between the PDF engine and the crypto engine.
 */

import type forge from "node-forge";
import { injectSignaturePlaceholder, injectSignatureIntoPlaceholder } from "./placeholder.js";
import { embedVisualSignature } from "./visual.js";
import { isValidPdf, analyzePdf } from "./reader.js";
import type { SignatureRenderOptions } from "./visual.js";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SignPdfOptions {
  /** Raw PDF bytes */
  pdfBuffer: Buffer;

  /** Signer's X.509 certificate (ephemeral) */
  signerCert: forge.pki.Certificate;

  /** Signer's RSA private key (ephemeral) */
  signerKey: forge.pki.rsa.PrivateKey;

  /** CA certificate chain [CA cert, root cert] */
  caCerts: forge.pki.Certificate[];

  /** Exact time of signing */
  signingTime: Date;

  /** RFC 3161 TSA URL (for AdES-B-T level) */
  tspUrl?: string;

  /** Visual signature options */
  visualSignature?: {
    /** Base64 image data URL */
    imageBase64: string;
    /** Position on page */
    position: {
      page: number;
      x: number;
      y: number;
      width?: number;
      height?: number;
    };
    /** Signer name for label */
    signerName: string;
    /** Legal standard label */
    legalStandard?: string;
    /** Signature level label */
    signatureLevel?: string;
    /** Locale for date formatting */
    locale?: string;
  };

  /**
   * Bytes to reserve for PKCS#7 signature.
   * @default 16384
   */
  signatureByteSize?: number;
}

export interface SignPdfResult {
  /** The fully signed PDF buffer */
  signedPdf: Buffer;
  /** SHA-256 hash of the signed PDF */
  documentHash: string;
  /** The byte ranges that were signed */
  byteRanges: [number, number, number, number];
  /** Size of the embedded PKCS#7 signature in bytes */
  pkcs7Size: number;
}

// ─────────────────────────────────────────────
// Orchestrator
// ─────────────────────────────────────────────

/**
 * Full PDF signing pipeline.
 *
 * @param options - Signing configuration with all required materials
 * @returns The finalized signed PDF and metadata
 */
export async function signPdf(options: SignPdfOptions): Promise<SignPdfResult> {
  const {
    pdfBuffer,
    signerCert,
    signerKey,
    caCerts,
    signingTime,
    tspUrl,
    visualSignature,
    signatureByteSize = 16384,
  } = options;

  // ── Step 1: Validate PDF ─────────────────────────────────────────────────
  if (!isValidPdf(pdfBuffer)) {
    throw new Error("Invalid PDF: file does not start with %PDF");
  }

  // ── Step 2: Analyze to get page info ─────────────────────────────────────
  const metadata = await analyzePdf(pdfBuffer);
  if (metadata.isEncrypted) {
    throw new Error(
      "Cannot sign an encrypted/password-protected PDF. " +
      "Please provide an unprotected version."
    );
  }

  // ── Step 3: Inject signature placeholder ─────────────────────────────────
  const { modifiedPdf, byteRanges, signatureOffset, signaturePlaceholderLength } =
    await injectSignaturePlaceholder({ pdfBuffer, signatureByteSize });

  // ── Step 4: Build PKCS#7 signature (lazy import to avoid circular deps) ───
  const { buildPKCS7Signature } = await import("@pdf-signature/crypto");

  const pkcs7Der = await buildPKCS7Signature({
    pdfBuffer: modifiedPdf,
    byteRanges,
    signerCert,
    signerKey,
    caCerts,
    signingTime,
    tspUrl,
    embedFullChain: true,
  });

  // ── Step 5: Inject PKCS#7 into the placeholder ───────────────────────────
  let signedPdf = injectSignatureIntoPlaceholder(
    modifiedPdf,
    pkcs7Der,
    signatureOffset,
    signaturePlaceholderLength
  );

  // ── Step 6: Add visual signature (optional) ───────────────────────────────
  if (visualSignature) {
    const visualResult = await embedVisualSignature(signedPdf, {
      signatureImageBase64: visualSignature.imageBase64,
      position: {
        page: visualSignature.position.page,
        x: visualSignature.position.x,
        y: visualSignature.position.y,
        width: visualSignature.position.width ?? 200,
        height: visualSignature.position.height ?? 60,
      },
      signerName: visualSignature.signerName,
      signedAt: signingTime,
      legalStandard: visualSignature.legalStandard,
      signatureLevel: visualSignature.signatureLevel,
      locale: visualSignature.locale,
      showBorder: true,
      showLabel: true,
    });
    signedPdf = visualResult.signedPdf;
  }

  // ── Step 7: Compute final document hash ───────────────────────────────────
  const { hashBuffer } = await import("@pdf-signature/crypto");
  const documentHash = hashBuffer(signedPdf, "sha256");

  return {
    signedPdf,
    documentHash,
    byteRanges,
    pkcs7Size: pkcs7Der.length,
  };
}

// ─────────────────────────────────────────────
// Verification Pipeline
// ─────────────────────────────────────────────

/**
 * Verify a signed PDF's cryptographic signatures.
 * Extracts PKCS#7 from the PDF and validates it.
 *
 * @returns Verification result with all signature details
 */
export async function verifySignedPdf(pdfBuffer: Buffer): Promise<{
  valid: boolean;
  signatures: Array<{
    signerEmail: string | null;
    signerName: string | null;
    signedAt: Date | null;
    certificateSerial: string | null;
    hasTimestamp: boolean;
    integrityPassed: boolean;
    error?: string;
  }>;
  documentHash: string;
}> {
  if (!isValidPdf(pdfBuffer)) {
    throw new Error("Invalid PDF file");
  }

  const { hashBuffer, verifyPKCS7Signature } = await import("@pdf-signature/crypto");
  const documentHash = hashBuffer(pdfBuffer, "sha256");

  // Extract signature dictionaries from the PDF
  const sigDicts = extractSignatureDictionaries(pdfBuffer);

  if (sigDicts.length === 0) {
    return { valid: false, signatures: [], documentHash };
  }

  const signatures = [];
  let allValid = true;

  for (const sigDict of sigDicts) {
    const result = verifyPKCS7Signature(
      sigDict.contentsHex,
      pdfBuffer,
      sigDict.byteRange
    );

    if (!result.valid) allValid = false;

    signatures.push({
      signerEmail: result.signerEmail,
      signerName: result.signerName,
      signedAt: result.signingTime,
      certificateSerial: result.certificateSerial,
      hasTimestamp: result.hasTimestamp,
      integrityPassed: result.valid,
      error: result.error,
    });
  }

  return { valid: allValid, signatures, documentHash };
}

/**
 * Extract /ByteRange and /Contents from all signature dictionaries in a PDF.
 * This is a simplified byte-scanning approach.
 */
function extractSignatureDictionaries(pdfBuffer: Buffer): Array<{
  contentsHex: string;
  byteRange: [number, number, number, number];
}> {
  const results: Array<{ contentsHex: string; byteRange: [number, number, number, number] }> = [];
  const pdfStr = pdfBuffer.toString("latin1");

  // Find all /SubFilter /adbe.pkcs7.detached occurrences
  let searchPos = 0;
  while (true) {
    const subFilterPos = pdfStr.indexOf("/adbe.pkcs7.detached", searchPos);
    if (subFilterPos === -1) break;
    searchPos = subFilterPos + 1;

    // Look backwards for the /ByteRange entry
    const dictStart = Math.max(0, subFilterPos - 2000);
    const dictSection = pdfStr.slice(dictStart, subFilterPos + 1000);

    // Extract /ByteRange [n1 n2 n3 n4]
    const byteRangeMatch = dictSection.match(
      /\/ByteRange\s*\[\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s*\]/
    );
    if (!byteRangeMatch) continue;

    const byteRange: [number, number, number, number] = [
      parseInt(byteRangeMatch[1] ?? "0"),
      parseInt(byteRangeMatch[2] ?? "0"),
      parseInt(byteRangeMatch[3] ?? "0"),
      parseInt(byteRangeMatch[4] ?? "0"),
    ];

    // Extract /Contents <hex>
    const contentsMatch = dictSection.match(/\/Contents\s*<([0-9A-Fa-f]+)>/);
    if (!contentsMatch) continue;

    results.push({
      contentsHex: contentsMatch[1] ?? "",
      byteRange,
    });
  }

  return results;
}
