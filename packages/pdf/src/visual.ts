/**
 * @pdf-signature/pdf — Visual Signature Module
 *
 * Renders the signer's signature image visually onto the PDF page.
 * This is the "ink on paper" visual representation that users expect to see.
 *
 * Important: The visual rendering is SEPARATE from the cryptographic signature.
 * The PKCS#7 signature (the real legal proof) is embedded in the byte range.
 * The visual image is just for human readability.
 *
 * Supported input formats:
 * - Base64 PNG/JPEG data URL: data:image/png;base64,iVBOR...
 * - SVG path data (from signature_pad)
 * - Raw text (for typed signatures — rendered in cursive font)
 */

import {
  PDFDocument,
  PDFPage,
  rgb,
  degrees,
  StandardFonts,
  BlendMode,
  LineCapStyle,
} from "pdf-lib";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface SignatureRenderOptions {
  /** Base64 data URL of the signature image (from signature pad) */
  signatureImageBase64: string;

  /** Position on the page where the signature should appear */
  position: {
    page: number;    // 1-indexed
    x: number;       // From left edge in PDF points
    y: number;       // From bottom edge in PDF points
    width: number;   // Width in PDF points (default: 200)
    height: number;  // Height in PDF points (default: 60)
  };

  /** Signer's display name for the label */
  signerName: string;

  /** The time the signature was applied */
  signedAt: Date;

  /** Legal standard label (shown below signature) */
  legalStandard?: string;

  /** Signature level label (e.g., "AdES-B-T") */
  signatureLevel?: string;

  /** Locale for date formatting */
  locale?: string;

  /** Whether to show a border around the signature box */
  showBorder?: boolean;

  /** Whether to show the signer name and date below the signature */
  showLabel?: boolean;

  /** Color of the border (hex: #1a3e8c) */
  borderColor?: string;

  /** Signature image opacity (0.0 to 1.0, default: 0.95) */
  opacity?: number;
}

export interface VisualSignatureResult {
  /** PDF buffer with the visual signature rendered */
  signedPdf: Buffer;
  /** The page where the signature was rendered */
  renderedOnPage: number;
}

// ─────────────────────────────────────────────
// Main Visual Rendering
// ─────────────────────────────────────────────

/**
 * Render the signer's signature image visually on the specified PDF page.
 *
 * @param pdfBuffer - The PDF buffer (after cryptographic signing)
 * @param options - Rendering configuration
 * @returns PDF buffer with the visual signature added
 */
export async function embedVisualSignature(
  pdfBuffer: Buffer,
  options: SignatureRenderOptions
): Promise<VisualSignatureResult> {
  const {
    signatureImageBase64,
    position,
    signerName,
    signedAt,
    legalStandard = "eIDAS",
    signatureLevel = "AdES-B-T",
    locale = "en",
    showBorder = true,
    showLabel = true,
    borderColor = "#1a3e8c",
    opacity = 0.95,
  } = options;

  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
    updateMetadata: false,
  });

  const pages = pdfDoc.getPages();
  const targetPage = pages[position.page - 1];

  if (!targetPage) {
    throw new Error(
      `Page ${position.page} does not exist. Document has ${pages.length} page(s).`
    );
  }

  const width = position.width ?? 200;
  const height = position.height ?? 60;

  // ── Step 1: Render signature image ───────────────────────────────────────
  await renderSignatureImage(
    pdfDoc,
    targetPage,
    signatureImageBase64,
    { x: position.x, y: position.y, width, height, opacity }
  );

  // ── Step 2: Draw label (name + date + legal standard) ────────────────────
  if (showLabel) {
    await renderSignatureLabel(pdfDoc, targetPage, {
      x: position.x,
      y: position.y - 18,
      width,
      signerName,
      signedAt,
      legalStandard,
      signatureLevel,
      locale,
    });
  }

  // ── Step 3: Draw border ───────────────────────────────────────────────────
  if (showBorder) {
    renderSignatureBorder(targetPage, {
      x: position.x - 3,
      y: position.y - (showLabel ? 22 : 3),
      width: width + 6,
      height: height + (showLabel ? 26 : 6),
      color: borderColor,
    });
  }

  // ── Step 4: Add an optional verification QR code ─────────────────────────
  // (Disabled by default, enabled in Pro plan)

  const finalBytes = await pdfDoc.save({ useObjectStreams: false });

  return {
    signedPdf: Buffer.from(finalBytes),
    renderedOnPage: position.page,
  };
}

// ─────────────────────────────────────────────
// Private: Image Rendering
// ─────────────────────────────────────────────

/**
 * Embed and draw the signature image on the page.
 * Handles both PNG and JPEG base64 data URLs.
 */
async function renderSignatureImage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  signatureImageBase64: string,
  opts: { x: number; y: number; width: number; height: number; opacity: number }
): Promise<void> {
  // Parse the base64 data URL
  const { mimeType, data } = parseDataUrl(signatureImageBase64);
  const imageBuffer = Buffer.from(data, "base64");

  let embeddedImage;

  if (mimeType === "image/png" || mimeType === "image/png+transparency") {
    embeddedImage = await pdfDoc.embedPng(imageBuffer);
  } else if (mimeType === "image/jpeg" || mimeType === "image/jpg") {
    embeddedImage = await pdfDoc.embedJpg(imageBuffer);
  } else {
    // For SVG or unknown types, try PNG first
    try {
      embeddedImage = await pdfDoc.embedPng(imageBuffer);
    } catch {
      // If all else fails, draw a placeholder rectangle
      page.drawRectangle({
        x: opts.x,
        y: opts.y,
        width: opts.width,
        height: opts.height,
        color: rgb(0.98, 0.98, 0.98),
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 0.5,
        opacity: opts.opacity,
      });
      return;
    }
  }

  page.drawImage(embeddedImage, {
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    opacity: opts.opacity,
    blendMode: BlendMode.Multiply,
  });
}

// ─────────────────────────────────────────────
// Private: Label Rendering
// ─────────────────────────────────────────────

interface LabelOptions {
  x: number;
  y: number;
  width: number;
  signerName: string;
  signedAt: Date;
  legalStandard: string;
  signatureLevel: string;
  locale: string;
}

async function renderSignatureLabel(
  pdfDoc: PDFDocument,
  page: PDFPage,
  opts: LabelOptions
): Promise<void> {
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const textColor = rgb(0.2, 0.2, 0.2);
  const subtleColor = rgb(0.5, 0.5, 0.5);
  const legalColor = rgb(0.1, 0.35, 0.7);

  // Line 1: "Digitally signed by: [Name]"
  page.drawText("Digitally signed by:", {
    x: opts.x,
    y: opts.y,
    size: 7,
    font,
    color: subtleColor,
  });

  page.drawText(opts.signerName, {
    x: opts.x + 82,
    y: opts.y,
    size: 7,
    font: fontBold,
    color: textColor,
    maxWidth: opts.width - 85,
  });

  // Line 2: Date and time
  const dateStr = formatSigningDate(opts.signedAt, opts.locale);
  page.drawText(`Date: ${dateStr}`, {
    x: opts.x,
    y: opts.y - 9,
    size: 6.5,
    font,
    color: subtleColor,
  });

  // Line 3: Legal standard
  page.drawText(`${opts.legalStandard} · ${opts.signatureLevel}`, {
    x: opts.x,
    y: opts.y - 18,
    size: 6,
    font: fontOblique,
    color: legalColor,
  });
}

// ─────────────────────────────────────────────
// Private: Border Rendering
// ─────────────────────────────────────────────

interface BorderOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

function renderSignatureBorder(page: PDFPage, opts: BorderOptions): void {
  const [r, g, b] = hexToRgb(opts.color);
  const borderRgb = rgb(r, g, b);

  page.drawRectangle({
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    borderColor: borderRgb,
    borderWidth: 0.75,
    borderLineCap: LineCapStyle.Round,
    color: rgb(0, 0, 0), // transparent fill
    opacity: 0,
    borderOpacity: 0.5,
  });
}

// ─────────────────────────────────────────────
// Public: Typed Signature Rendering
// ─────────────────────────────────────────────

/**
 * Render a typed (text-based) signature in a cursive style.
 * Used when the signer chooses to type their name instead of drawing.
 *
 * @param text - The typed signature text
 * @returns Base64 PNG data URL representation of the typed signature
 */
export function renderTypedSignatureToBase64(text: string): string {
  // In a real Node.js implementation, this would use canvas or sharp
  // to render text with a cursive font (Dancing Script, Great Vibes, etc.)
  // For now, return a placeholder that the client-side canvas renders
  return `data:image/svg+xml;base64,${Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="80">` +
    `<text x="10" y="60" font-family="cursive" font-size="40" fill="#1a1a2e">${escapeXml(text)}</text>` +
    `</svg>`
  ).toString("base64")}`;
}

// ─────────────────────────────────────────────
// Public: Stamp Rendering (official seal)
// ─────────────────────────────────────────────

/**
 * Add a "SIGNED" stamp overlay to a page for visual clarity.
 * Used in high-security documents.
 */
export async function addSignedStamp(
  pdfBuffer: Buffer,
  pageNumber: number,
  position: { x: number; y: number }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });

  const pages = pdfDoc.getPages();
  const page = pages[pageNumber - 1];
  if (!page) return pdfBuffer;

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Rotated "SIGNED" text
  page.drawText("SIGNED", {
    x: position.x,
    y: position.y,
    size: 48,
    font,
    color: rgb(0.1, 0.5, 0.1),
    rotate: degrees(30),
    opacity: 0.15,
  });

  const finalBytes = await pdfDoc.save({ useObjectStreams: false });
  return Buffer.from(finalBytes);
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  // Format: data:<mimeType>;base64,<data>
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    // Assume raw base64 PNG if no prefix
    return { mimeType: "image/png", data: dataUrl };
  }
  return { mimeType: match[1] ?? "image/png", data: match[2] ?? "" };
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [0.1, 0.35, 0.7]; // Default blue

  return [
    parseInt(result[1] ?? "1a", 16) / 255,
    parseInt(result[2] ?? "59", 16) / 255,
    parseInt(result[3] ?? "b3", 16) / 255,
  ];
}

function formatSigningDate(date: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : locale, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
