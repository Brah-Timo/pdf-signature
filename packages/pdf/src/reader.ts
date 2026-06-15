/**
 * @pdf-signature/pdf — PDF Reader Module
 *
 * Reads and analyzes PDF structure to extract metadata needed for signing.
 * Uses pdf-lib for pure JavaScript PDF parsing (no native dependencies).
 */

import { PDFDocument, PDFDict, PDFName, PDFArray, PDFNumber } from "pdf-lib";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface PdfMetadata {
  /** Number of pages in the document */
  pageCount: number;
  /** PDF format version (e.g., "1.4", "1.7", "2.0") */
  pdfVersion: string;
  /** Document title from PDF metadata */
  title?: string;
  /** Document author from PDF metadata */
  author?: string;
  /** Creation date from PDF metadata */
  createdAt?: Date;
  /** Modification date */
  modifiedAt?: Date;
  /** Whether the document is password-protected */
  isEncrypted: boolean;
  /** Whether the document already has digital signatures */
  hasExistingSignatures: boolean;
  /** Number of existing signatures */
  existingSignatureCount: number;
  /** Page dimensions (width × height in PDF points) */
  pages: Array<{
    width: number;
    height: number;
    rotation: number;
  }>;
  /** Total file size in bytes */
  fileSizeBytes: number;
}

export interface SignatureField {
  /** Field name in the PDF */
  name: string;
  /** Which page (1-indexed) */
  page: number;
  /** Bounding box [x, y, width, height] in PDF points */
  rect: [number, number, number, number];
  /** Whether already signed */
  isSigned: boolean;
}

// ─────────────────────────────────────────────
// PDF Analysis
// ─────────────────────────────────────────────

/**
 * Analyze a PDF document and extract metadata.
 * This is the first step in the signing pipeline — we need to know
 * page dimensions for signature positioning.
 *
 * @param pdfBuffer - Raw PDF bytes
 * @returns Structured PDF metadata
 */
export async function analyzePdf(pdfBuffer: Buffer): Promise<PdfMetadata> {
  // Validate PDF magic bytes first (fast check before full parse)
  if (!isValidPdf(pdfBuffer)) {
    throw new Error(
      "Invalid PDF: file does not start with PDF magic bytes (%PDF)"
    );
  }

  let pdfDoc: PDFDocument;
  let isEncrypted = false;

  try {
    pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
      updateMetadata: false,
    });
  } catch (error) {
    // Check if it's an encryption error
    if ((error as Error).message?.includes("encrypt")) {
      isEncrypted = true;
      return {
        pageCount: 0,
        pdfVersion: "unknown",
        isEncrypted: true,
        hasExistingSignatures: false,
        existingSignatureCount: 0,
        pages: [],
        fileSizeBytes: pdfBuffer.length,
      };
    }
    throw new Error(`Failed to parse PDF: ${(error as Error).message}`);
  }

  const pages = pdfDoc.getPages();
  const pageInfo = pages.map((page) => {
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle;
    return { width, height, rotation };
  });

  // Check for existing signature fields (AcroForm /Sig type fields)
  let existingSignatureCount = 0;
  try {
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    existingSignatureCount = fields.filter((f) => {
      try {
        // Signature fields have /FT /Sig in their dictionary
        const fieldDict = f.acroField.dict;
        const ft = fieldDict.get(PDFName.of("FT"));
        return ft?.toString() === "/Sig";
      } catch {
        return false;
      }
    }).length;
  } catch {
    existingSignatureCount = 0;
  }

  // Extract metadata
  let title: string | undefined;
  let author: string | undefined;
  let createdAt: Date | undefined;
  let modifiedAt: Date | undefined;

  try {
    title = pdfDoc.getTitle() ?? undefined;
    author = pdfDoc.getAuthor() ?? undefined;
    const created = pdfDoc.getCreationDate();
    const modified = pdfDoc.getModificationDate();
    createdAt = created ?? undefined;
    modifiedAt = modified ?? undefined;
  } catch {
    // Metadata extraction failure is non-fatal
  }

  return {
    pageCount: pages.length,
    pdfVersion: extractPdfVersion(pdfBuffer),
    title,
    author,
    createdAt,
    modifiedAt,
    isEncrypted,
    hasExistingSignatures: existingSignatureCount > 0,
    existingSignatureCount,
    pages: pageInfo,
    fileSizeBytes: pdfBuffer.length,
  };
}

/**
 * Extract existing AcroForm signature fields from a PDF.
 * Returns their positions for visual overlay matching.
 */
export async function extractSignatureFields(
  pdfBuffer: Buffer
): Promise<SignatureField[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
    throwOnInvalidObject: false,
  });

  const fields: SignatureField[] = [];

  try {
    const form = pdfDoc.getForm();
    const allFields = form.getFields();

    for (const field of allFields) {
      const fieldDict = field.acroField.dict;
      const ft = fieldDict.get(PDFName.of("FT"));

      if (ft?.toString() !== "/Sig") continue;

      // Get the widget annotation for position
      const kids = fieldDict.get(PDFName.of("Kids"));
      const rectArray = fieldDict.get(PDFName.of("Rect")) as PDFArray | undefined;

      if (!rectArray) continue;

      const rect: [number, number, number, number] = [
        (rectArray.get(0) as PDFNumber)?.asNumber() ?? 0,
        (rectArray.get(1) as PDFNumber)?.asNumber() ?? 0,
        (rectArray.get(2) as PDFNumber)?.asNumber() ?? 0,
        (rectArray.get(3) as PDFNumber)?.asNumber() ?? 0,
      ];

      // Determine which page this field is on
      let pageIndex = 0;
      try {
        const pages = pdfDoc.getPages();
        for (let i = 0; i < pages.length; i++) {
          // This is a simplified heuristic — real implementation
          // would traverse the Page Tree properly
          pageIndex = i;
          break;
        }
      } catch {
        pageIndex = 0;
      }

      fields.push({
        name: field.getName(),
        page: pageIndex + 1,
        rect,
        isSigned: false, // Would need to check /V entry
      });
    }
  } catch {
    // Field extraction failure is non-fatal
  }

  return fields;
}

// ─────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────

/**
 * Validate that a buffer is a PDF by checking magic bytes.
 */
export function isValidPdf(buffer: Buffer): boolean {
  if (buffer.length < 4) return false;
  return (
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46    // F
  );
}

/**
 * Extract the PDF version string from the first line of the file.
 * Returns "unknown" if not found.
 */
function extractPdfVersion(buffer: Buffer): string {
  const header = buffer.subarray(0, 20).toString("ascii");
  const match = header.match(/%PDF-(\d+\.\d+)/);
  return match?.[1] ?? "unknown";
}

/**
 * Get the dimensions of a specific page (1-indexed).
 *
 * @returns { width, height } in PDF points, or default A4 if page not found
 */
export async function getPageDimensions(
  pdfBuffer: Buffer,
  pageNumber: number
): Promise<{ width: number; height: number }> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: true,
      throwOnInvalidObject: false,
    });
    const pages = pdfDoc.getPages();
    const page = pages[pageNumber - 1];

    if (!page) {
      // Default to A4 dimensions in pt (595 × 842)
      return { width: 595.28, height: 841.89 };
    }

    return page.getSize();
  } catch {
    return { width: 595.28, height: 841.89 };
  }
}
