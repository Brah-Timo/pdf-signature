/**
 * @pdf-signature/crypto
 * Cryptographic engine for pdf-signature
 *
 * Exports all crypto utilities needed by the API server and PDF engine.
 */

// Hashing and HMAC
export {
  hashBuffer,
  hashBufferRaw,
  hashBufferBinary,
  hashString,
  hashPdfByteRanges,
  signHmac,
  verifyHmac,
  randomHex,
  generateSignatureId,
  generateAuditTrailId,
  generateSessionId,
  type HashAlgorithm,
} from "./hash.js";

// X.509 Certificate operations
export {
  generateEphemeralCertificate,
  loadCertificateFromPem,
  loadCertOnlyFromPem,
  verifyCertificateSignature,
  isCertificateValid,
  extractEmailFromCert,
  generateTestCACertificate,
  type EphemeralCertOptions,
  type EphemeralCertResult,
  type LoadedCertificate,
} from "./x509.js";

// PKCS#7 / CMS Signature building and verification
export {
  buildPKCS7Signature,
  verifyPKCS7Signature,
  pkcs7DerToHexPadded,
  type PKCS7SignatureOptions,
  type PKCS7VerificationResult,
} from "./pkcs7.js";

// RFC 3161 Timestamping
export {
  fetchTimestampToken,
  parseTimestampTokenTime,
  generateMockTimestampToken,
  TSA_URLS,
  type TimestampRequest,
  type TimestampResponse,
} from "./timestamp.js";

// RSA and AES encryption utilities
export {
  generateRsaKeyPair,
  rsaSign,
  rsaVerify,
  aesEncrypt,
  aesDecrypt,
  generateAesKey,
  deriveKey,
  safeCompare,
  generateApiKey,
  hashApiKey,
  type RsaKeyPair,
  type EncryptedData,
} from "./rsa.js";
