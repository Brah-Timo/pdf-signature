/**
 * @pdf-signature/pdf
 * PDF processing engine for pdf-signature
 */

// PDF Analysis
export {
  analyzePdf,
  extractSignatureFields,
  isValidPdf,
  getPageDimensions,
  type PdfMetadata,
  type SignatureField,
} from "./reader.js";

// Placeholder injection and signature embedding
export {
  injectSignaturePlaceholder,
  injectSignatureIntoPlaceholder,
  type PlaceholderOptions,
  type PlaceholderResult,
} from "./placeholder.js";

// Visual signature rendering
export {
  embedVisualSignature,
  renderTypedSignatureToBase64,
  addSignedStamp,
  type SignatureRenderOptions,
  type VisualSignatureResult,
} from "./visual.js";

// Full signing pipeline orchestrator
export {
  signPdf,
  verifySignedPdf,
  type SignPdfOptions,
  type SignPdfResult,
} from "./writer.js";
