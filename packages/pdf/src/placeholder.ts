/**
 * @pdf-signature/pdf — Signature Placeholder Module
 *
 * Injects a byte range placeholder into a PDF to reserve space
 * for the PKCS#7 signature that will be computed and injected later.
 *
 * The PDF Digital Signature architecture requires:
 * 1. Reserve a specific number of bytes in the PDF for the signature
 * 2. Compute the hash of all PDF bytes EXCEPT the reserved space
 * 3. Build a PKCS#7 signature over that hash
 * 4. Inject the signature into the reserved space
 *
 * This two-step process is what allows verifiers to re-compute the hash
 * over exactly the same bytes without needing to modify the signature.
 */

import { PDFDocument, PDFDict, PDFName, PDFArray, PDFNumber, PDFString } from "pdf-lib";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PlaceholderOptions {
  /**
   * The PDF buffer to inject the placeholder into.
   * Must be a valid PDF (validated by isValidPdf before calling this).
   */
  pdfBuffer: Buffer;

  /**
   * Number of bytes to reserve for the PKCS#7 signature.
   * Must be larger than the expected signature.
   *
   * Rule of thumb:
   * - Basic (no TSP): 8192 bytes
   * - With TSP token: 16384 bytes
   * - With full chain: 32768 bytes
   *
   * @default 16384 (16KB — safe for AdES-B-T with full chain)
   */
  signatureByteSize?: number;

  /**
   * Optional: Name for the signature field in the PDF AcroForm.
   * @default "Signature1"
   */
  fieldName?: string;
}

export interface PlaceholderResult {
  /**
   * The modified PDF buffer with the placeholder injected.
   * The placeholder is filled with zero bytes (ASCII '0' characters in hex).
   */
  modifiedPdf: Buffer;

  /**
   * The byte range values describing the exact bytes to sign.
   * Format: [offset1, length1, offset2, length2]
   *
   * The bytes to sign = modifiedPdf[offset1..offset1+length1]
   *                   + modifiedPdf[offset2..offset2+length2]
   *
   * The excluded bytes (the signature placeholder) are:
   * modifiedPdf[offset1+length1..offset2] (including the '<' '>' delimiters)
   */
  byteRanges: [number, number, number, number];

  /**
   * The offset in the PDF where the signature hex string starts.
   * Used when injecting the final PKCS#7 signature.
   */
  signatureOffset: number;

  /**
   * The number of hex characters available in the placeholder.
   * = signatureByteSize * 2 (since each byte = 2 hex chars)
   */
  signaturePlaceholderLength: number;
}

// ─────────────────────────────────────────────
// Placeholder Injection
// ─────────────────────────────────────────────

/**
 * Inject a digital signature placeholder into a PDF.
 *
 * This is a critical operation — the byte range calculation must be
 * perfectly accurate for the signature to be verifiable.
 *
 * Implementation approach:
 * 1. Add an invisible signature annotation/field using pdf-lib
 * 2. Serialize the PDF to get the raw bytes
 * 3. Find the /ByteRange and /Contents entries in the serialized PDF
 * 4. Update /ByteRange to reflect the actual byte positions
 * 5. Fill /Contents with zeros (placeholder)
 *
 * @param options - Placeholder configuration
 * @returns Modified PDF and precise byte range values
 */
export async function injectSignaturePlaceholder(
  options: PlaceholderOptions
): Promise<PlaceholderResult> {
  const {
    pdfBuffer,
    signatureByteSize = 16384,
    fieldName = "Signature1",
  } = options;

  // The placeholder hex string: signatureByteSize * 2 zeros
  // In PDF, /Contents is stored as a hex string: <0000...0000>
  const placeholderHex = "0".repeat(signatureByteSize * 2);

  // ── Step 1: Load and prepare the PDF ─────────────────────────────────────
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });

  // ── Step 2: Add signature dictionary to the PDF ───────────────────────────
  // We append a new /Sig field to the AcroForm
  const sigDict = pdfDoc.context.obj({
    Type: "Sig",
    Filter: "/Adobe.PPKLite",
    SubFilter: "/adbe.pkcs7.detached",
    // ByteRange will be updated after serialization
    ByteRange: [0, 0, 0, 0],
    // Contents will hold the actual PKCS#7 signature in hex
    Contents: PDFString.of(placeholderHex),
    Reason: PDFString.of("Signed with pdf-signature"),
    Name: PDFString.of("pdf-signature"),
  });

  // ── Step 3: Serialize the PDF to bytes ────────────────────────────────────
  const pdfBytes = await pdfDoc.save({
    useObjectStreams: false, // Required for incremental update signing
    addDefaultPage: false,
  });

  let pdfBuffer2 = Buffer.from(pdfBytes);

  // ── Step 4: Find the ByteRange placeholder in the serialized PDF ──────────
  // We search for the pattern: /ByteRange [0 0 0 0]
  const byteRangeStr = "/ByteRange [0 0 0 0]";
  const byteRangePos = findBytePattern(pdfBuffer2, byteRangeStr);

  if (byteRangePos === -1) {
    // Fallback: manually construct the ByteRange string
    return buildPlaceholderFallback(pdfBuffer, signatureByteSize);
  }

  // ── Step 5: Find the Contents placeholder in the PDF ─────────────────────
  // Pattern: /Contents <000000...>
  const contentsPrefix = "/Contents <";
  const contentsPrefixPos = findBytePattern(pdfBuffer2, contentsPrefix);

  if (contentsPrefixPos === -1) {
    return buildPlaceholderFallback(pdfBuffer, signatureByteSize);
  }

  const signatureOffset = contentsPrefixPos + contentsPrefix.length;

  // ── Step 6: Calculate byte ranges ────────────────────────────────────────
  // The bytes BEFORE the signature placeholder
  const offset1 = 0;
  const length1 = signatureOffset - 1; // -1 to exclude the '<'

  // The bytes AFTER the signature placeholder
  const signaturePlaceholderLength = signatureByteSize * 2;
  const offset2 = signatureOffset + signaturePlaceholderLength + 1; // +1 to skip '>'
  const length2 = pdfBuffer2.length - offset2;

  const byteRanges: [number, number, number, number] = [
    offset1, length1, offset2, length2,
  ];

  // ── Step 7: Update /ByteRange in the PDF with actual values ───────────────
  const byteRangeValueStr = `[${byteRanges.join(" ")}]`;
  const byteRangeValuePadded = byteRangeValueStr.padEnd(
    byteRangeStr.length - "/ByteRange ".length,
    " "
  );

  const updatedByteRange = `/ByteRange ${byteRangeValuePadded}`;
  const updatedByteRangeBuffer = Buffer.from(updatedByteRange, "ascii");

  // Write the updated byte range back into the PDF
  const byteRangeBuf = Buffer.from(byteRangeStr, "ascii");
  for (let i = 0; i < byteRangeBuf.length && i < updatedByteRangeBuffer.length; i++) {
    pdfBuffer2[byteRangePos + i] = updatedByteRangeBuffer[i] ?? 0x20;
  }

  return {
    modifiedPdf: pdfBuffer2,
    byteRanges,
    signatureOffset,
    signaturePlaceholderLength,
  };
}

// ─────────────────────────────────────────────
// Signature Injection
// ─────────────────────────────────────────────

/**
 * Inject the final PKCS#7 signature into the placeholder reserved in the PDF.
 *
 * @param pdfWithPlaceholder - PDF buffer containing the zero-filled placeholder
 * @param pkcs7DerBuffer - The actual PKCS#7 DER-encoded signature
 * @param byteRanges - The byte range values from injectSignaturePlaceholder()
 * @param signatureOffset - The exact position where the signature hex goes
 * @param placeholderLength - Length of the placeholder hex string
 * @returns Final signed PDF buffer
 */
export function injectSignatureIntoPlaceholder(
  pdfWithPlaceholder: Buffer,
  pkcs7DerBuffer: Buffer,
  signatureOffset: number,
  placeholderLength: number
): Buffer {
  const signatureHex = pkcs7DerBuffer.toString("hex").toUpperCase();

  if (signatureHex.length > placeholderLength) {
    throw new Error(
      `Signature too large: ${signatureHex.length} hex chars > placeholder ${placeholderLength} hex chars. ` +
      `Increase signatureByteSize. Current: ${placeholderLength / 2} bytes, ` +
      `Required: at least ${Math.ceil(signatureHex.length / 2)} bytes.`
    );
  }

  // Pad the signature with zeros to fill the exact placeholder space
  const paddedSignature = signatureHex.padEnd(placeholderLength, "0");
  const signatureBuffer = Buffer.from(paddedSignature, "ascii");

  // Copy the signature into the PDF buffer at the exact offset
  const finalPdf = Buffer.from(pdfWithPlaceholder);
  signatureBuffer.copy(finalPdf, signatureOffset);

  return finalPdf;
}

// ─────────────────────────────────────────────
// Fallback Implementation
// ─────────────────────────────────────────────

/**
 * Fallback placeholder injection using direct byte manipulation.
 * Used when pdf-lib's serialization format doesn't match expected patterns.
 */
async function buildPlaceholderFallback(
  originalPdf: Buffer,
  signatureByteSize: number
): Promise<PlaceholderResult> {
  const placeholderHex = "0".repeat(signatureByteSize * 2);

  // Build the signature dictionary as raw PDF syntax
  const sigDictStr = [
    "<<",
    "/Type /Sig",
    "/Filter /Adobe.PPKLite",
    "/SubFilter /adbe.pkcs7.detached",
    `/ByteRange [0 0000000000 0000000000 0000000000]`,
    `/Contents <${placeholderHex}>`,
    "/Reason (Signed with pdf-signature)",
    ">>",
  ].join("\n");

  // Append to existing PDF
  const sigDictBuffer = Buffer.from(sigDictStr, "ascii");
  const combined = Buffer.concat([originalPdf, Buffer.from("\n"), sigDictBuffer]);

  const signatureOffsetSearch = combined.indexOf("/Contents <");
  const signatureOffset = signatureOffsetSearch + "/Contents <".length;

  const offset1 = 0;
  const length1 = signatureOffset - 1;
  const offset2 = signatureOffset + signatureByteSize * 2 + 1;
  const length2 = combined.length - offset2;

  return {
    modifiedPdf: combined,
    byteRanges: [offset1, length1, offset2, length2],
    signatureOffset,
    signaturePlaceholderLength: signatureByteSize * 2,
  };
}

// ─────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────

/**
 * Find the first occurrence of a string pattern in a Buffer.
 * @returns Byte offset of the pattern start, or -1 if not found
 */
function findBytePattern(buffer: Buffer, pattern: string): number {
  const patternBuffer = Buffer.from(pattern, "ascii");

  for (let i = 0; i <= buffer.length - patternBuffer.length; i++) {
    let found = true;
    for (let j = 0; j < patternBuffer.length; j++) {
      if (buffer[i + j] !== patternBuffer[j]) {
        found = false;
        break;
      }
    }
    if (found) return i;
  }
  return -1;
}
