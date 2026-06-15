/**
 * @pdf-signature/crypto — X.509 Certificate Module
 *
 * Generates ephemeral X.509 v3 certificates for each signing event.
 * These short-lived certificates are created per-signature, signed by our CA,
 * and embedded in the PKCS#7 signature container.
 *
 * The certificate binds the signer's email to a freshly-generated RSA key pair,
 * ensuring non-repudiation and meeting AdES Advanced requirements.
 */

import forge from "node-forge";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface EphemeralCertOptions {
  /** Signer's verified email address */
  signerEmail: string;
  /** Signer's display name */
  signerName: string;
  /** Certificate validity period in hours (default: 1) */
  validityHours?: number;
  /** RSA key size in bits (default: 2048, use 4096 for higher security) */
  keyBits?: 2048 | 4096;
  /** CA certificate that signs this ephemeral cert */
  caCert: forge.pki.Certificate;
  /** CA private key for signing */
  caKey: forge.pki.rsa.PrivateKey;
  /** Country code for Subject (default: 'SA') */
  country?: string;
  /** Organization name in Subject */
  organization?: string;
}

export interface EphemeralCertResult {
  /** The generated X.509 certificate */
  cert: forge.pki.Certificate;
  /** The generated RSA private key (used ONCE for this signature only) */
  privateKey: forge.pki.rsa.PrivateKey;
  /** PEM-encoded certificate (for storage/transmission) */
  certPem: string;
  /** PEM-encoded private key */
  privateKeyPem: string;
  /** Certificate serial number (hex) */
  serialNumber: string;
}

export interface LoadedCertificate {
  cert: forge.pki.Certificate;
  key: forge.pki.rsa.PrivateKey;
}

// ─────────────────────────────────────────────
// Certificate Generation
// ─────────────────────────────────────────────

/**
 * Generate an ephemeral X.509 v3 certificate for a single signing event.
 *
 * This certificate:
 * - Has a very short validity (default 1 hour from signing time)
 * - Contains the signer's email in Subject Alternative Name
 * - Has digitalSignature + nonRepudiation key usage
 * - Includes Adobe PDF Signing extended key usage OID
 * - Is signed by the pdf-signature CA
 *
 * @example
 * const { cert, privateKey } = generateEphemeralCertificate({
 *   signerEmail: 'ali@company.com',
 *   signerName: 'Ali Al-Ghamdi',
 *   caCert: loadedCA.cert,
 *   caKey: loadedCA.key,
 * });
 */
export function generateEphemeralCertificate(
  options: EphemeralCertOptions
): EphemeralCertResult {
  const {
    signerEmail,
    signerName,
    validityHours = 1,
    keyBits = 2048,
    caCert,
    caKey,
    country = "SA",
    organization = "pdf-signature Ephemeral",
  } = options;

  // ── Step 1: Generate a fresh RSA key pair for THIS signing event only ──────
  const keys = forge.pki.rsa.generateKeyPair({ bits: keyBits, e: 0x10001 });

  // ── Step 2: Create the certificate structure ──────────────────────────────
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;

  // Serial number: timestamp in hex + random bytes to ensure uniqueness
  const serialHex = (
    BigInt(Date.now()) * BigInt(0x10000) +
    BigInt(Math.floor(Math.random() * 0x10000))
  )
    .toString(16)
    .toUpperCase()
    .padStart(20, "0");
  cert.serialNumber = serialHex;

  // ── Step 3: Validity period ───────────────────────────────────────────────
  const now = new Date();
  // Small grace period (5 minutes back) to handle slight clock differences
  const notBefore = new Date(now.getTime() - 5 * 60 * 1000);
  const notAfter = new Date(now.getTime() + validityHours * 60 * 60 * 1000);

  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;

  // ── Step 4: Subject (signer identity) ─────────────────────────────────────
  cert.setSubject([
    { name: "commonName", value: signerName },
    { name: "emailAddress", value: signerEmail },
    { shortName: "O", value: organization },
    { shortName: "OU", value: "Electronic Signature" },
    { shortName: "C", value: country },
  ]);

  // ── Step 5: Issuer (our CA) ───────────────────────────────────────────────
  cert.setIssuer(caCert.subject.attributes);

  // ── Step 6: Extensions for eIDAS Advanced Electronic Signature ────────────
  cert.setExtensions([
    // Not a CA certificate
    {
      name: "basicConstraints",
      cA: false,
      critical: true,
    },

    // Key usage: must include digitalSignature and nonRepudiation for AdES
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: false,
      dataEncipherment: false,
    },

    // Extended key usage: email protection + Adobe PDF signing
    {
      name: "extKeyUsage",
      emailProtection: true,
      // Adobe Acrobat PDF signing OID (1.2.840.113583.1.1.10)
      "1.2.840.113583.1.1.10": true,
    },

    // Subject Alternative Name: binds certificate to signer's email
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 1, // rfc822Name (email)
          value: signerEmail,
        },
      ],
    },

    // Subject Key Identifier (required for chain validation)
    { name: "subjectKeyIdentifier" },

    // Authority Key Identifier (links to CA)
    {
      name: "authorityKeyIdentifier",
      keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes(),
    },

    // Certificate Policies — reference to eIDAS regulation
    {
      name: "certificatePolicies",
      value: [
        {
          id: "1.3.6.1.4.1.99999.1.1", // pdf-signature policy OID
          value: [
            {
              id: "1.3.6.1.5.5.7.2.1", // id-qt-cps
              value: "https://pdf-signature.dev/cps",
            },
          ],
        },
      ],
    },
  ]);

  // ── Step 7: Sign the certificate with the CA's private key ────────────────
  cert.sign(caKey, forge.md.sha256.create());

  // ── Step 8: Export to PEM for storage ─────────────────────────────────────
  const certPem = forge.pki.certificateToPem(cert);
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey);

  return {
    cert,
    privateKey: keys.privateKey,
    certPem,
    privateKeyPem,
    serialNumber: cert.serialNumber,
  };
}

// ─────────────────────────────────────────────
// Certificate Loading
// ─────────────────────────────────────────────

/**
 * Load a CA certificate and its private key from PEM strings.
 * Call this once at startup — keeps the CA in memory for fast ephemeral cert generation.
 *
 * @throws Error if PEM strings are invalid
 */
export function loadCertificateFromPem(
  certPem: string,
  privateKeyPem: string
): LoadedCertificate {
  try {
    const cert = forge.pki.certificateFromPem(certPem);
    const key = forge.pki.privateKeyFromPem(privateKeyPem) as forge.pki.rsa.PrivateKey;
    return { cert, key };
  } catch (error) {
    throw new Error(
      `Failed to load certificate from PEM: ${(error as Error).message}`
    );
  }
}

/**
 * Load a certificate-only PEM (for root/intermediate certs in the chain).
 */
export function loadCertOnlyFromPem(certPem: string): forge.pki.Certificate {
  try {
    return forge.pki.certificateFromPem(certPem);
  } catch (error) {
    throw new Error(
      `Failed to load certificate PEM: ${(error as Error).message}`
    );
  }
}

// ─────────────────────────────────────────────
// Certificate Verification
// ─────────────────────────────────────────────

/**
 * Verify that a certificate was signed by the given CA.
 *
 * @returns true if the certificate's signature is valid against the CA
 */
export function verifyCertificateSignature(
  cert: forge.pki.Certificate,
  caCert: forge.pki.Certificate
): boolean {
  try {
    return caCert.verify(cert);
  } catch {
    return false;
  }
}

/**
 * Check if a certificate is currently within its validity period.
 */
export function isCertificateValid(cert: forge.pki.Certificate): boolean {
  const now = new Date();
  return (
    now >= cert.validity.notBefore &&
    now <= cert.validity.notAfter
  );
}

/**
 * Extract the email address from a certificate's Subject Alternative Name.
 * Returns null if not found.
 */
export function extractEmailFromCert(
  cert: forge.pki.Certificate
): string | null {
  const sanExtension = cert.extensions.find(
    (ext: { name: string }) => ext.name === "subjectAltName"
  ) as { altNames?: Array<{ type: number; value: string }> } | undefined;

  if (!sanExtension?.altNames) return null;

  const emailEntry = sanExtension.altNames.find(
    (alt: { type: number; value: string }) => alt.type === 1
  );
  return emailEntry?.value ?? null;
}

// ─────────────────────────────────────────────
// Self-Signed CA Generator (Development/Testing)
// ─────────────────────────────────────────────

/**
 * Generate a self-signed Root CA certificate.
 * **USE ONLY FOR DEVELOPMENT AND TESTING.**
 * In production, use a proper CA with hardware security modules.
 *
 * @returns PEM strings for the CA cert and private key
 */
export function generateTestCACertificate(): {
  certPem: string;
  privateKeyPem: string;
} {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 4096, e: 0x10001 });
  const cert = forge.pki.createCertificate();

  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";

  const now = new Date();
  cert.validity.notBefore = now;
  cert.validity.notAfter = new Date(
    now.getFullYear() + 10,
    now.getMonth(),
    now.getDate()
  );

  const attrs = [
    { name: "commonName", value: "pdf-signature Development CA" },
    { shortName: "O", value: "pdf-signature" },
    { shortName: "OU", value: "Development" },
    { shortName: "C", value: "SA" },
  ];

  cert.setSubject(attrs);
  cert.setIssuer(attrs);

  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" },
  ]);

  cert.sign(keys.privateKey, forge.md.sha256.create());

  return {
    certPem: forge.pki.certificateToPem(cert),
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
  };
}
