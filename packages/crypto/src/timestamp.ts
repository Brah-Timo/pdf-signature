/**
 * @pdf-signature/crypto — RFC 3161 Timestamp Module
 *
 * Fetches cryptographic timestamps from trusted Timestamp Authorities (TSA).
 * This is what elevates a signature from AdES-B to AdES-B-T level.
 *
 * An RFC 3161 timestamp proves that the signature existed at a specific point
 * in time, allowing long-term validation even after the signer's certificate
 * has expired. This is crucial for contracts that need to be valid for years.
 *
 * Supported TSAs:
 * - DigiCert: https://timestamp.digicert.com
 * - Sectigo: https://tsa.sectigo.com
 * - FreeTSA: https://freetsa.org/tsr (free, for testing)
 * - GlobalSign: https://timestamp.globalsign.com/tsa/r6advanced1
 */

import forge from "node-forge";
import axios from "axios";
import { createHash } from "crypto";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TimestampRequest {
  /** The data to timestamp (usually the signature value or document hash) */
  data: Buffer;
  /** Hash algorithm to use (default: sha256) */
  hashAlgorithm?: "sha256" | "sha384" | "sha512";
  /** TSA server URL */
  tsaUrl: string;
  /** TSA authentication (if required) */
  username?: string;
  password?: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
}

export interface TimestampResponse {
  /** The DER-encoded timestamp token */
  token: Buffer;
  /** The time embedded in the timestamp */
  generatedAt: Date;
  /** The TSA's serial number for this timestamp */
  serialNumber: string;
  /** Name of the Timestamp Authority */
  tsaName: string;
}

// ─────────────────────────────────────────────
// Well-Known TSA URLs
// ─────────────────────────────────────────────

export const TSA_URLS = {
  DIGICERT: "https://timestamp.digicert.com",
  SECTIGO: "https://tsa.sectigo.com",
  GLOBALSIGN: "https://timestamp.globalsign.com/tsa/r6advanced1",
  FREETSA: "https://freetsa.org/tsr",
  COMODO: "https://timestamp.comodoca.com",
  ENTRUST: "https://timestamp.entrust.net/TSS/RFC3161sha2TS",
} as const;

// ─────────────────────────────────────────────
// TSQ (Timestamp Query) Builder
// ─────────────────────────────────────────────

/**
 * Build a DER-encoded RFC 3161 TimeStampReq (timestamp request).
 *
 * Structure (ASN.1):
 * TimeStampReq ::= SEQUENCE {
 *   version INTEGER { v1(1) },
 *   messageImprint MessageImprint,
 *   reqPolicy TSAPolicyId OPTIONAL,
 *   nonce INTEGER OPTIONAL,
 *   certReq BOOLEAN DEFAULT FALSE,
 *   extensions [0] IMPLICIT Extensions OPTIONAL
 * }
 */
function buildTimestampRequest(
  dataBuffer: Buffer,
  hashAlgorithm: "sha256" | "sha384" | "sha512" = "sha256"
): Buffer {
  // Compute hash of the data (the signature value or document hash)
  const hash = createHash(hashAlgorithm).update(dataBuffer).digest();

  // OID for hash algorithms
  const hashOids: Record<string, string> = {
    sha256: "2.16.840.1.101.3.4.2.1",
    sha384: "2.16.840.1.101.3.4.2.2",
    sha512: "2.16.840.1.101.3.4.2.3",
  };

  const hashOid = hashOids[hashAlgorithm];
  if (!hashOid) throw new Error(`Unsupported hash algorithm: ${hashAlgorithm}`);

  // Generate random nonce (prevents replay attacks)
  const nonce = BigInt(
    "0x" + createHash("sha256").update(Date.now().toString()).digest("hex").slice(0, 16)
  );

  // Build ASN.1 structure using node-forge
  const tsReqAsn1 = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      // version: INTEGER 1
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.INTEGER,
        false,
        forge.asn1.integerToDer(1).getBytes()
      ),
      // messageImprint: SEQUENCE
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.SEQUENCE,
        true,
        [
          // hashAlgorithm: AlgorithmIdentifier
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.SEQUENCE,
            true,
            [
              forge.asn1.create(
                forge.asn1.Class.UNIVERSAL,
                forge.asn1.Type.OID,
                false,
                forge.asn1.oidToDer(hashOid).getBytes()
              ),
              // NULL parameters
              forge.asn1.create(
                forge.asn1.Class.UNIVERSAL,
                forge.asn1.Type.NULL,
                false,
                ""
              ),
            ]
          ),
          // hashedMessage: OCTET STRING
          forge.asn1.create(
            forge.asn1.Class.UNIVERSAL,
            forge.asn1.Type.OCTETSTRING,
            false,
            hash.toString("binary")
          ),
        ]
      ),
      // nonce: INTEGER (random, prevents replay)
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.INTEGER,
        false,
        forge.asn1.integerToDer(Number(nonce % BigInt(Number.MAX_SAFE_INTEGER))).getBytes()
      ),
      // certReq: BOOLEAN TRUE (we want the TSA's cert embedded in the response)
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.BOOLEAN,
        false,
        "\xff" // true
      ),
    ]
  );

  const der = forge.asn1.toDer(tsReqAsn1);
  return Buffer.from(der.getBytes(), "binary");
}

// ─────────────────────────────────────────────
// Fetch Timestamp Token
// ─────────────────────────────────────────────

/**
 * Request a cryptographic timestamp from a TSA server.
 *
 * The returned token is a DER-encoded TimeStampToken (RFC 3161).
 * It proves that the input `data` existed before the timestamp was issued.
 *
 * @param data - The signature value to timestamp (Buffer)
 * @param tsaUrl - Timestamp Authority URL
 * @param options - Optional configuration
 * @returns DER-encoded timestamp token as Buffer
 *
 * @example
 * const token = await fetchTimestampToken(
 *   signatureValueBuffer,
 *   'https://timestamp.digicert.com'
 * );
 */
export async function fetchTimestampToken(
  data: Buffer,
  tsaUrl: string,
  options?: {
    hashAlgorithm?: "sha256" | "sha384" | "sha512";
    username?: string;
    password?: string;
    timeout?: number;
  }
): Promise<Buffer> {
  const {
    hashAlgorithm = "sha256",
    username,
    password,
    timeout = 10_000,
  } = options ?? {};

  // Build the RFC 3161 TimeStampReq
  const tsqBuffer = buildTimestampRequest(data, hashAlgorithm);

  // Prepare HTTP headers
  const headers: Record<string, string> = {
    "Content-Type": "application/timestamp-query",
    "Accept": "application/timestamp-reply",
    "User-Agent": "pdf-signature/1.0.0 (RFC 3161 TSA Client)",
  };

  // Add Basic Auth if credentials provided
  if (username && password) {
    const credentials = Buffer.from(`${username}:${password}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }

  try {
    const response = await axios.post(tsaUrl, tsqBuffer, {
      headers,
      responseType: "arraybuffer",
      timeout,
      maxContentLength: 1024 * 1024, // 1MB max response
    });

    const responseBuffer = Buffer.from(response.data as ArrayBuffer);

    // Parse the TimeStampResp to extract the TimeStampToken
    const token = extractTokenFromResponse(responseBuffer);

    return token;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `TSA request to ${tsaUrl} failed: ${error.message} ` +
        `(status: ${error.response?.status ?? "network error"})`
      );
    }
    throw error;
  }
}

/**
 * Extract the TimeStampToken from a TimeStampResp response.
 * Validates that the response indicates success (status 0).
 */
function extractTokenFromResponse(responseBuffer: Buffer): Buffer {
  try {
    const respAsn1 = forge.asn1.fromDer(
      responseBuffer.toString("binary"),
      { strict: false }
    );

    // TimeStampResp structure:
    // SEQUENCE {
    //   PKIStatusInfo SEQUENCE { status INTEGER, ... }
    //   TimeStampToken SEQUENCE (ContentInfo) OPTIONAL
    // }
    const resp = respAsn1.value as forge.asn1.Asn1[];
    if (!resp?.[0] || !resp?.[1]) {
      throw new Error("Invalid TimeStampResp structure");
    }

    // Check PKIStatusInfo — status 0 = granted, 1 = grantedWithMods
    const statusInfo = resp[0].value as forge.asn1.Asn1[];
    const statusValue = statusInfo?.[0];
    if (!statusValue) throw new Error("No status in TimeStampResp");

    const statusInt = forge.asn1.derToInteger(
      forge.util.createBuffer((statusValue as forge.asn1.Asn1).value as string)
    );

    if (statusInt > 1) {
      throw new Error(
        `TSA rejected the request with status: ${statusInt}. ` +
        `Status 0=granted, 1=grantedWithMods, 2=rejection, 3=waiting, 4=revocationWarning, 5=revocationNotification`
      );
    }

    // Extract the TimeStampToken (ContentInfo wrapping a SignedData)
    const tokenAsn1 = resp[1];
    const tokenDer = forge.asn1.toDer(tokenAsn1);

    return Buffer.from(tokenDer.getBytes(), "binary");
  } catch (error) {
    throw new Error(
      `Failed to parse TSA response: ${(error as Error).message}`
    );
  }
}

// ─────────────────────────────────────────────
// Timestamp Verification
// ─────────────────────────────────────────────

/**
 * Parse a timestamp token and extract its embedded time.
 *
 * @param tokenBuffer - DER-encoded timestamp token
 * @returns The time embedded in the timestamp token, or null if parsing fails
 */
export function parseTimestampTokenTime(tokenBuffer: Buffer): Date | null {
  try {
    const asn1 = forge.asn1.fromDer(tokenBuffer.toString("binary"), {
      strict: false,
    });

    // ContentInfo > SignedData > encapContentInfo > eContent > TSTInfo
    // This traversal path follows RFC 3161 structure
    const contentInfo = asn1.value as forge.asn1.Asn1[];
    const signedData = (contentInfo?.[1]?.value as forge.asn1.Asn1[])?.[0];
    const signedDataSeq = signedData?.value as forge.asn1.Asn1[];

    // Find encapContentInfo (index 2 in SignedData)
    const encapContentInfo = signedDataSeq?.[2]?.value as forge.asn1.Asn1[];
    const eContent = encapContentInfo?.[1]?.value as forge.asn1.Asn1[];
    const tstInfoDer = eContent?.[0];

    if (!tstInfoDer) return null;

    const tstInfoAsn1 = forge.asn1.fromDer(
      (tstInfoDer.value as string) ?? "",
      { strict: false }
    );
    const tstInfo = tstInfoAsn1.value as forge.asn1.Asn1[];

    // genTime is at index 4 in TSTInfo (version, policy, messageImprint, serialNumber, genTime, ...)
    const genTimeAsn1 = tstInfo?.[4];
    if (!genTimeAsn1) return null;

    // Parse GeneralizedTime format: YYYYMMDDHHmmssZ
    const timeStr = genTimeAsn1.value as string;
    const year = parseInt(timeStr.slice(0, 4), 10);
    const month = parseInt(timeStr.slice(4, 6), 10) - 1;
    const day = parseInt(timeStr.slice(6, 8), 10);
    const hour = parseInt(timeStr.slice(8, 10), 10);
    const minute = parseInt(timeStr.slice(10, 12), 10);
    const second = parseInt(timeStr.slice(12, 14), 10);

    return new Date(Date.UTC(year, month, day, hour, minute, second));
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────
// Fallback: Mock Timestamp (Development Only)
// ─────────────────────────────────────────────

/**
 * Generate a mock timestamp token for development and testing.
 * **DO NOT USE IN PRODUCTION — this does not provide legal TSA proof.**
 */
export function generateMockTimestampToken(signingTime: Date = new Date()): Buffer {
  // Build a minimal DER structure that looks like a timestamp token
  // Real production tokens come from accredited TSAs
  const mockToken = forge.asn1.create(
    forge.asn1.Class.UNIVERSAL,
    forge.asn1.Type.SEQUENCE,
    true,
    [
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.OID,
        false,
        forge.asn1.oidToDer("1.2.840.113549.1.7.2").getBytes() // id-signedData
      ),
      forge.asn1.create(
        forge.asn1.Class.UNIVERSAL,
        forge.asn1.Type.GENERALIZEDTIME,
        false,
        formatGeneralizedTime(signingTime)
      ),
    ]
  );

  const der = forge.asn1.toDer(mockToken);
  return Buffer.from(der.getBytes(), "binary");
}

function formatGeneralizedTime(date: Date): string {
  const pad = (n: number): string => n.toString().padStart(2, "0");
  return (
    date.getUTCFullYear().toString() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    "Z"
  );
}
