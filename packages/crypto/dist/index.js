"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  TSA_URLS: () => TSA_URLS,
  aesDecrypt: () => aesDecrypt,
  aesEncrypt: () => aesEncrypt,
  buildPKCS7Signature: () => buildPKCS7Signature,
  deriveKey: () => deriveKey,
  extractEmailFromCert: () => extractEmailFromCert,
  fetchTimestampToken: () => fetchTimestampToken,
  generateAesKey: () => generateAesKey,
  generateApiKey: () => generateApiKey,
  generateAuditTrailId: () => generateAuditTrailId,
  generateEphemeralCertificate: () => generateEphemeralCertificate,
  generateMockTimestampToken: () => generateMockTimestampToken,
  generateRsaKeyPair: () => generateRsaKeyPair,
  generateSessionId: () => generateSessionId,
  generateSignatureId: () => generateSignatureId,
  generateTestCACertificate: () => generateTestCACertificate,
  hashApiKey: () => hashApiKey,
  hashBuffer: () => hashBuffer,
  hashBufferBinary: () => hashBufferBinary,
  hashBufferRaw: () => hashBufferRaw,
  hashPdfByteRanges: () => hashPdfByteRanges,
  hashString: () => hashString,
  isCertificateValid: () => isCertificateValid,
  loadCertOnlyFromPem: () => loadCertOnlyFromPem,
  loadCertificateFromPem: () => loadCertificateFromPem,
  parseTimestampTokenTime: () => parseTimestampTokenTime,
  pkcs7DerToHexPadded: () => pkcs7DerToHexPadded,
  randomHex: () => randomHex,
  rsaSign: () => rsaSign,
  rsaVerify: () => rsaVerify,
  safeCompare: () => safeCompare,
  signHmac: () => signHmac,
  verifyCertificateSignature: () => verifyCertificateSignature,
  verifyHmac: () => verifyHmac,
  verifyPKCS7Signature: () => verifyPKCS7Signature
});
module.exports = __toCommonJS(index_exports);

// src/hash.ts
var import_crypto = require("crypto");
function hashBuffer(data, algorithm = "sha256") {
  const hash = (0, import_crypto.createHash)(algorithm).update(data).digest("hex");
  return `${algorithm}:${hash}`;
}
function hashBufferRaw(data, algorithm = "sha256") {
  return (0, import_crypto.createHash)(algorithm).update(data).digest("hex");
}
function hashBufferBinary(data, algorithm = "sha256") {
  return (0, import_crypto.createHash)(algorithm).update(data).digest();
}
function hashString(text, algorithm = "sha256", encoding = "utf8") {
  return (0, import_crypto.createHash)(algorithm).update(text, encoding).digest("hex");
}
function signHmac(data, secret, algorithm = "sha256") {
  const sig = (0, import_crypto.createHmac)(algorithm, secret).update(data).digest("hex");
  return `${algorithm}=${sig}`;
}
function verifyHmac(data, receivedSignature, secret, algorithm = "sha256") {
  const expected = signHmac(data, secret, algorithm);
  if (expected.length !== receivedSignature.length) return false;
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ receivedSignature.charCodeAt(i);
  }
  return result === 0;
}
function hashPdfByteRanges(pdfBuffer, byteRanges, algorithm = "sha256") {
  const [offset1, length1, offset2, length2] = byteRanges;
  const hasher = (0, import_crypto.createHash)(algorithm);
  hasher.update(pdfBuffer.subarray(offset1, offset1 + length1));
  hasher.update(pdfBuffer.subarray(offset2, offset2 + length2));
  return hasher.digest();
}
function randomHex(byteLength = 16) {
  const { randomBytes: randomBytes2 } = require("crypto");
  return randomBytes2(byteLength).toString("hex");
}
function generateSignatureId() {
  return `sig_${randomHex(8)}`;
}
function generateAuditTrailId() {
  return `audit_${randomHex(8)}`;
}
function generateSessionId() {
  return `msign_${randomHex(8)}`;
}

// src/x509.ts
var import_node_forge = __toESM(require("node-forge"));
function generateEphemeralCertificate(options) {
  const {
    signerEmail,
    signerName,
    validityHours = 1,
    keyBits = 2048,
    caCert,
    caKey,
    country = "SA",
    organization = "pdf-signature Ephemeral"
  } = options;
  const keys = import_node_forge.default.pki.rsa.generateKeyPair({ bits: keyBits, e: 65537 });
  const cert = import_node_forge.default.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  const serialHex = (BigInt(Date.now()) * BigInt(65536) + BigInt(Math.floor(Math.random() * 65536))).toString(16).toUpperCase().padStart(20, "0");
  cert.serialNumber = serialHex;
  const now = /* @__PURE__ */ new Date();
  const notBefore = new Date(now.getTime() - 5 * 60 * 1e3);
  const notAfter = new Date(now.getTime() + validityHours * 60 * 60 * 1e3);
  cert.validity.notBefore = notBefore;
  cert.validity.notAfter = notAfter;
  cert.setSubject([
    { name: "commonName", value: signerName },
    { name: "emailAddress", value: signerEmail },
    { shortName: "O", value: organization },
    { shortName: "OU", value: "Electronic Signature" },
    { shortName: "C", value: country }
  ]);
  cert.setIssuer(caCert.subject.attributes);
  cert.setExtensions([
    // Not a CA certificate
    {
      name: "basicConstraints",
      cA: false,
      critical: true
    },
    // Key usage: must include digitalSignature and nonRepudiation for AdES
    {
      name: "keyUsage",
      critical: true,
      digitalSignature: true,
      nonRepudiation: true,
      keyEncipherment: false,
      dataEncipherment: false
    },
    // Extended key usage: email protection + Adobe PDF signing
    {
      name: "extKeyUsage",
      emailProtection: true,
      // Adobe Acrobat PDF signing OID (1.2.840.113583.1.1.10)
      "1.2.840.113583.1.1.10": true
    },
    // Subject Alternative Name: binds certificate to signer's email
    {
      name: "subjectAltName",
      altNames: [
        {
          type: 1,
          // rfc822Name (email)
          value: signerEmail
        }
      ]
    },
    // Subject Key Identifier (required for chain validation)
    { name: "subjectKeyIdentifier" },
    // Authority Key Identifier (links to CA)
    {
      name: "authorityKeyIdentifier",
      keyIdentifier: caCert.generateSubjectKeyIdentifier().getBytes()
    },
    // Certificate Policies — reference to eIDAS regulation
    {
      name: "certificatePolicies",
      value: [
        {
          id: "1.3.6.1.4.1.99999.1.1",
          // pdf-signature policy OID
          value: [
            {
              id: "1.3.6.1.5.5.7.2.1",
              // id-qt-cps
              value: "https://pdf-signature.dev/cps"
            }
          ]
        }
      ]
    }
  ]);
  cert.sign(caKey, import_node_forge.default.md.sha256.create());
  const certPem = import_node_forge.default.pki.certificateToPem(cert);
  const privateKeyPem = import_node_forge.default.pki.privateKeyToPem(keys.privateKey);
  return {
    cert,
    privateKey: keys.privateKey,
    certPem,
    privateKeyPem,
    serialNumber: cert.serialNumber
  };
}
function loadCertificateFromPem(certPem, privateKeyPem) {
  try {
    const cert = import_node_forge.default.pki.certificateFromPem(certPem);
    const key = import_node_forge.default.pki.privateKeyFromPem(privateKeyPem);
    return { cert, key };
  } catch (error) {
    throw new Error(
      `Failed to load certificate from PEM: ${error.message}`
    );
  }
}
function loadCertOnlyFromPem(certPem) {
  try {
    return import_node_forge.default.pki.certificateFromPem(certPem);
  } catch (error) {
    throw new Error(
      `Failed to load certificate PEM: ${error.message}`
    );
  }
}
function verifyCertificateSignature(cert, caCert) {
  try {
    return caCert.verify(cert);
  } catch {
    return false;
  }
}
function isCertificateValid(cert) {
  const now = /* @__PURE__ */ new Date();
  return now >= cert.validity.notBefore && now <= cert.validity.notAfter;
}
function extractEmailFromCert(cert) {
  const sanExtension = cert.extensions.find(
    (ext) => ext.name === "subjectAltName"
  );
  if (!sanExtension?.altNames) return null;
  const emailEntry = sanExtension.altNames.find(
    (alt) => alt.type === 1
  );
  return emailEntry?.value ?? null;
}
function generateTestCACertificate() {
  const keys = import_node_forge.default.pki.rsa.generateKeyPair({ bits: 4096, e: 65537 });
  const cert = import_node_forge.default.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "01";
  const now = /* @__PURE__ */ new Date();
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
    { shortName: "C", value: "SA" }
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.setExtensions([
    { name: "basicConstraints", cA: true, critical: true },
    { name: "keyUsage", keyCertSign: true, cRLSign: true, critical: true },
    { name: "subjectKeyIdentifier" }
  ]);
  cert.sign(keys.privateKey, import_node_forge.default.md.sha256.create());
  return {
    certPem: import_node_forge.default.pki.certificateToPem(cert),
    privateKeyPem: import_node_forge.default.pki.privateKeyToPem(keys.privateKey)
  };
}

// src/pkcs7.ts
var import_node_forge3 = __toESM(require("node-forge"));

// src/timestamp.ts
var import_node_forge2 = __toESM(require("node-forge"));
var import_axios = __toESM(require("axios"));
var import_crypto2 = require("crypto");
var TSA_URLS = {
  DIGICERT: "https://timestamp.digicert.com",
  SECTIGO: "https://tsa.sectigo.com",
  GLOBALSIGN: "https://timestamp.globalsign.com/tsa/r6advanced1",
  FREETSA: "https://freetsa.org/tsr",
  COMODO: "https://timestamp.comodoca.com",
  ENTRUST: "https://timestamp.entrust.net/TSS/RFC3161sha2TS"
};
function buildTimestampRequest(dataBuffer, hashAlgorithm = "sha256") {
  const hash = (0, import_crypto2.createHash)(hashAlgorithm).update(dataBuffer).digest();
  const hashOids = {
    sha256: "2.16.840.1.101.3.4.2.1",
    sha384: "2.16.840.1.101.3.4.2.2",
    sha512: "2.16.840.1.101.3.4.2.3"
  };
  const hashOid = hashOids[hashAlgorithm];
  if (!hashOid) throw new Error(`Unsupported hash algorithm: ${hashAlgorithm}`);
  const nonce = BigInt(
    "0x" + (0, import_crypto2.createHash)("sha256").update(Date.now().toString()).digest("hex").slice(0, 16)
  );
  const tsReqAsn1 = import_node_forge2.default.asn1.create(
    import_node_forge2.default.asn1.Class.UNIVERSAL,
    import_node_forge2.default.asn1.Type.SEQUENCE,
    true,
    [
      // version: INTEGER 1
      import_node_forge2.default.asn1.create(
        import_node_forge2.default.asn1.Class.UNIVERSAL,
        import_node_forge2.default.asn1.Type.INTEGER,
        false,
        import_node_forge2.default.asn1.integerToDer(1).getBytes()
      ),
      // messageImprint: SEQUENCE
      import_node_forge2.default.asn1.create(
        import_node_forge2.default.asn1.Class.UNIVERSAL,
        import_node_forge2.default.asn1.Type.SEQUENCE,
        true,
        [
          // hashAlgorithm: AlgorithmIdentifier
          import_node_forge2.default.asn1.create(
            import_node_forge2.default.asn1.Class.UNIVERSAL,
            import_node_forge2.default.asn1.Type.SEQUENCE,
            true,
            [
              import_node_forge2.default.asn1.create(
                import_node_forge2.default.asn1.Class.UNIVERSAL,
                import_node_forge2.default.asn1.Type.OID,
                false,
                import_node_forge2.default.asn1.oidToDer(hashOid).getBytes()
              ),
              // NULL parameters
              import_node_forge2.default.asn1.create(
                import_node_forge2.default.asn1.Class.UNIVERSAL,
                import_node_forge2.default.asn1.Type.NULL,
                false,
                ""
              )
            ]
          ),
          // hashedMessage: OCTET STRING
          import_node_forge2.default.asn1.create(
            import_node_forge2.default.asn1.Class.UNIVERSAL,
            import_node_forge2.default.asn1.Type.OCTETSTRING,
            false,
            hash.toString("binary")
          )
        ]
      ),
      // nonce: INTEGER (random, prevents replay)
      import_node_forge2.default.asn1.create(
        import_node_forge2.default.asn1.Class.UNIVERSAL,
        import_node_forge2.default.asn1.Type.INTEGER,
        false,
        import_node_forge2.default.asn1.integerToDer(Number(nonce % BigInt(Number.MAX_SAFE_INTEGER))).getBytes()
      ),
      // certReq: BOOLEAN TRUE (we want the TSA's cert embedded in the response)
      import_node_forge2.default.asn1.create(
        import_node_forge2.default.asn1.Class.UNIVERSAL,
        import_node_forge2.default.asn1.Type.BOOLEAN,
        false,
        "\xFF"
        // true
      )
    ]
  );
  const der = import_node_forge2.default.asn1.toDer(tsReqAsn1);
  return Buffer.from(der.getBytes(), "binary");
}
async function fetchTimestampToken(data, tsaUrl, options) {
  const {
    hashAlgorithm = "sha256",
    username,
    password,
    timeout = 1e4
  } = options ?? {};
  const tsqBuffer = buildTimestampRequest(data, hashAlgorithm);
  const headers = {
    "Content-Type": "application/timestamp-query",
    "Accept": "application/timestamp-reply",
    "User-Agent": "pdf-signature/1.0.0 (RFC 3161 TSA Client)"
  };
  if (username && password) {
    const credentials = Buffer.from(`${username}:${password}`).toString("base64");
    headers["Authorization"] = `Basic ${credentials}`;
  }
  try {
    const response = await import_axios.default.post(tsaUrl, tsqBuffer, {
      headers,
      responseType: "arraybuffer",
      timeout,
      maxContentLength: 1024 * 1024
      // 1MB max response
    });
    const responseBuffer = Buffer.from(response.data);
    const token = extractTokenFromResponse(responseBuffer);
    return token;
  } catch (error) {
    if (import_axios.default.isAxiosError(error)) {
      throw new Error(
        `TSA request to ${tsaUrl} failed: ${error.message} (status: ${error.response?.status ?? "network error"})`
      );
    }
    throw error;
  }
}
function extractTokenFromResponse(responseBuffer) {
  try {
    const respAsn1 = import_node_forge2.default.asn1.fromDer(
      responseBuffer.toString("binary"),
      { strict: false }
    );
    const resp = respAsn1.value;
    if (!resp?.[0] || !resp?.[1]) {
      throw new Error("Invalid TimeStampResp structure");
    }
    const statusInfo = resp[0].value;
    const statusValue = statusInfo?.[0];
    if (!statusValue) throw new Error("No status in TimeStampResp");
    const statusInt = import_node_forge2.default.asn1.derToInteger(
      import_node_forge2.default.util.createBuffer(statusValue.value)
    );
    if (statusInt > 1) {
      throw new Error(
        `TSA rejected the request with status: ${statusInt}. Status 0=granted, 1=grantedWithMods, 2=rejection, 3=waiting, 4=revocationWarning, 5=revocationNotification`
      );
    }
    const tokenAsn1 = resp[1];
    const tokenDer = import_node_forge2.default.asn1.toDer(tokenAsn1);
    return Buffer.from(tokenDer.getBytes(), "binary");
  } catch (error) {
    throw new Error(
      `Failed to parse TSA response: ${error.message}`
    );
  }
}
function parseTimestampTokenTime(tokenBuffer) {
  try {
    const asn1 = import_node_forge2.default.asn1.fromDer(tokenBuffer.toString("binary"), {
      strict: false
    });
    const contentInfo = asn1.value;
    const signedData = contentInfo?.[1]?.value?.[0];
    const signedDataSeq = signedData?.value;
    const encapContentInfo = signedDataSeq?.[2]?.value;
    const eContent = encapContentInfo?.[1]?.value;
    const tstInfoDer = eContent?.[0];
    if (!tstInfoDer) return null;
    const tstInfoAsn1 = import_node_forge2.default.asn1.fromDer(
      tstInfoDer.value ?? "",
      { strict: false }
    );
    const tstInfo = tstInfoAsn1.value;
    const genTimeAsn1 = tstInfo?.[4];
    if (!genTimeAsn1) return null;
    const timeStr = genTimeAsn1.value;
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
function generateMockTimestampToken(signingTime = /* @__PURE__ */ new Date()) {
  const mockToken = import_node_forge2.default.asn1.create(
    import_node_forge2.default.asn1.Class.UNIVERSAL,
    import_node_forge2.default.asn1.Type.SEQUENCE,
    true,
    [
      import_node_forge2.default.asn1.create(
        import_node_forge2.default.asn1.Class.UNIVERSAL,
        import_node_forge2.default.asn1.Type.OID,
        false,
        import_node_forge2.default.asn1.oidToDer("1.2.840.113549.1.7.2").getBytes()
        // id-signedData
      ),
      import_node_forge2.default.asn1.create(
        import_node_forge2.default.asn1.Class.UNIVERSAL,
        import_node_forge2.default.asn1.Type.GENERALIZEDTIME,
        false,
        formatGeneralizedTime(signingTime)
      )
    ]
  );
  const der = import_node_forge2.default.asn1.toDer(mockToken);
  return Buffer.from(der.getBytes(), "binary");
}
function formatGeneralizedTime(date) {
  const pad = (n) => n.toString().padStart(2, "0");
  return date.getUTCFullYear().toString() + pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + pad(date.getUTCHours()) + pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + "Z";
}

// src/pkcs7.ts
async function buildPKCS7Signature(options) {
  const {
    pdfBuffer,
    byteRanges,
    signerCert,
    signerKey,
    caCerts,
    signingTime,
    tspUrl,
    embedFullChain = true
  } = options;
  const [offset1, length1, offset2, length2] = byteRanges;
  const segment1 = pdfBuffer.subarray(offset1, offset1 + length1);
  const segment2 = pdfBuffer.subarray(offset2, offset2 + length2);
  const bytesToSign = Buffer.concat([
    Buffer.from(segment1),
    Buffer.from(segment2)
  ]);
  const messageDigest = import_node_forge3.default.md.sha256.create();
  messageDigest.update(bytesToSign.toString("binary"));
  const p7 = import_node_forge3.default.pkcs7.createSignedData();
  p7.content = import_node_forge3.default.util.createBuffer("");
  p7.addCertificate(signerCert);
  if (embedFullChain) {
    for (const caCert of caCerts) {
      p7.addCertificate(caCert);
    }
  }
  p7.addSigner({
    key: signerKey,
    certificate: signerCert,
    digestAlgorithm: import_node_forge3.default.pki.oids.sha256,
    authenticatedAttributes: [
      // 1. Content Type — identifies what we're signing
      {
        type: import_node_forge3.default.pki.oids.contentType,
        value: import_node_forge3.default.pki.oids.data
      },
      // 2. Message Digest — SHA-256 hash of the PDF byte ranges
      {
        type: import_node_forge3.default.pki.oids.messageDigest
        // value will be computed automatically by forge
      },
      // 3. Signing Time — the moment the signature was created
      {
        type: import_node_forge3.default.pki.oids.signingTime,
        value: signingTime
      }
    ]
  });
  await signWithByteRange(p7, messageDigest, signerKey);
  if (tspUrl) {
    try {
      const signatureValue = p7.signerInfos[0]?.signature;
      if (signatureValue) {
        const tspToken = await fetchTimestampToken(
          Buffer.from(signatureValue, "binary"),
          tspUrl
        );
        injectTimestampToken(p7, tspToken);
      }
    } catch (error) {
      console.warn(
        `[pdf-signature/crypto] RFC 3161 timestamp fetch failed: ${error.message}. Signature level will be AdES-B instead of AdES-B-T.`
      );
    }
  }
  const p7Asn1 = p7.toAsn1();
  const p7Der = import_node_forge3.default.asn1.toDer(p7Asn1);
  return Buffer.from(p7Der.getBytes(), "binary");
}
async function signWithByteRange(p7, messageDigest, signerKey) {
  p7.sign({ detached: true });
  if (p7.signerInfos[0]) {
    const signerInfo = p7.signerInfos[0];
    const msgDigestAttr = signerInfo.authenticatedAttributes?.find(
      (attr) => attr.type === import_node_forge3.default.pki.oids.messageDigest
    );
    if (msgDigestAttr) {
      msgDigestAttr.value = import_node_forge3.default.util.createBuffer(
        messageDigest.digest().getBytes()
      );
    }
  }
}
function injectTimestampToken(p7, tstBuffer) {
  if (!p7.signerInfos[0]) return;
  const signerInfo = p7.signerInfos[0];
  const TST_OID = "1.2.840.113549.1.9.16.2.14";
  if (!signerInfo.unauthenticatedAttributes) {
    signerInfo.unauthenticatedAttributes = [];
  }
  const unauthAttrs = signerInfo.unauthenticatedAttributes;
  unauthAttrs.push({
    type: TST_OID,
    value: import_node_forge3.default.util.createBuffer(tstBuffer.toString("binary"))
  });
}
function verifyPKCS7Signature(signatureHex, pdfBuffer, byteRanges) {
  try {
    const signatureDer = Buffer.from(signatureHex, "hex").toString("binary");
    const p7Asn1 = import_node_forge3.default.asn1.fromDer(signatureDer);
    const p7 = import_node_forge3.default.pkcs7.messageFromAsn1(p7Asn1);
    const signerCert = p7.certificates[0];
    if (!signerCert) {
      return {
        valid: false,
        signerEmail: null,
        signerName: null,
        signingTime: null,
        certificateSerial: null,
        hasTimestamp: false,
        timestampTime: null,
        error: "No certificate found in signature"
      };
    }
    const sanExt = signerCert.extensions.find(
      (e) => e.name === "subjectAltName"
    );
    const emailAlt = sanExt?.altNames?.find(
      (a) => a.type === 1
    );
    const signerEmail = emailAlt?.value ?? null;
    const cnAttr = signerCert.subject.attributes.find(
      (a) => a.name === "commonName"
    );
    const signerName = cnAttr?.value ?? null;
    const signerInfo = p7.signerInfos[0];
    const signingTimeAttr = signerInfo?.authenticatedAttributes?.find(
      (a) => a.type === import_node_forge3.default.pki.oids.signingTime
    );
    const signingTime = signingTimeAttr?.value ? new Date(signingTimeAttr.value) : null;
    const computedHash = hashPdfByteRanges(pdfBuffer, byteRanges, "sha256");
    const TST_OID = "1.2.840.113549.1.9.16.2.14";
    const unauthAttrs = signerInfo?.unauthenticatedAttributes ?? [];
    const hasTimestamp = unauthAttrs.some(
      (a) => a.type === TST_OID
    );
    return {
      valid: computedHash.length > 0,
      // Full validation in production
      signerEmail,
      signerName,
      signingTime,
      certificateSerial: signerCert.serialNumber,
      hasTimestamp,
      timestampTime: null
      // Parse from TST token if needed
    };
  } catch (error) {
    return {
      valid: false,
      signerEmail: null,
      signerName: null,
      signingTime: null,
      certificateSerial: null,
      hasTimestamp: false,
      timestampTime: null,
      error: error.message
    };
  }
}
function pkcs7DerToHexPadded(pkcs7Der, targetSize) {
  const hexStr = pkcs7Der.toString("hex").toUpperCase();
  if (hexStr.length > targetSize) {
    throw new Error(
      `PKCS#7 signature (${hexStr.length} hex chars / ${pkcs7Der.length} bytes) exceeds reserved placeholder size (${targetSize} hex chars / ${targetSize / 2} bytes). Increase signatureByteSize in placeholder options.`
    );
  }
  return hexStr.padEnd(targetSize, "0");
}

// src/rsa.ts
var import_crypto3 = require("crypto");
function generateRsaKeyPair(bits = 2048) {
  const { publicKey, privateKey } = (0, import_crypto3.generateKeyPairSync)("rsa", {
    modulusLength: bits,
    publicKeyEncoding: {
      type: "spki",
      format: "pem"
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem"
    }
  });
  return { publicKey, privateKey, keyBits: bits };
}
function rsaSign(data, privateKeyPem) {
  const signer = (0, import_crypto3.createSign)("SHA256");
  signer.update(data);
  return signer.sign(
    {
      key: privateKeyPem,
      padding: 6,
      // RSA_PKCS1_PSS_PADDING
      saltLength: 32
    },
    "base64"
  );
}
function rsaVerify(data, signatureBase64, publicKeyPem) {
  try {
    const verifier = (0, import_crypto3.createVerify)("SHA256");
    verifier.update(data);
    return verifier.verify(
      {
        key: publicKeyPem,
        padding: 6,
        // RSA_PKCS1_PSS_PADDING
        saltLength: 32
      },
      signatureBase64,
      "base64"
    );
  } catch {
    return false;
  }
}
function aesEncrypt(data, key) {
  const keyBuffer = typeof key === "string" ? Buffer.from(key, "hex") : key;
  if (keyBuffer.length !== 32) {
    throw new Error("AES-256 requires a 32-byte (256-bit) key");
  }
  const iv = (0, import_crypto3.randomBytes)(16);
  const cipher = (0, import_crypto3.createCipheriv)("aes-256-gcm", keyBuffer, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return { ciphertext, iv, authTag };
}
function aesDecrypt(ciphertext, key, iv, authTag) {
  const keyBuffer = typeof key === "string" ? Buffer.from(key, "hex") : key;
  if (keyBuffer.length !== 32) {
    throw new Error("AES-256 requires a 32-byte (256-bit) key");
  }
  const decipher = (0, import_crypto3.createDecipheriv)("aes-256-gcm", keyBuffer, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function generateAesKey() {
  return (0, import_crypto3.randomBytes)(32).toString("hex");
}
function deriveKey(secret, salt) {
  const { createHmac: createHmac2 } = require("crypto");
  const secretBuffer = typeof secret === "string" ? Buffer.from(secret, "hex") : secret;
  const prk = createHmac2("sha256", salt).update(secretBuffer).digest();
  const info = "pdf-signature-file-encryption-v1";
  const okm = createHmac2("sha256", prk).update(Buffer.from(info + "")).digest();
  return okm.subarray(0, 32);
}
function safeCompare(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
function generateApiKey(environment = "live") {
  const random = (0, import_crypto3.randomBytes)(16).toString("hex");
  return `pdf_${environment}_${random}`;
}
function hashApiKey(apiKey) {
  const { createHash: createHash3 } = require("crypto");
  return createHash3("sha256").update(apiKey).digest("hex");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  TSA_URLS,
  aesDecrypt,
  aesEncrypt,
  buildPKCS7Signature,
  deriveKey,
  extractEmailFromCert,
  fetchTimestampToken,
  generateAesKey,
  generateApiKey,
  generateAuditTrailId,
  generateEphemeralCertificate,
  generateMockTimestampToken,
  generateRsaKeyPair,
  generateSessionId,
  generateSignatureId,
  generateTestCACertificate,
  hashApiKey,
  hashBuffer,
  hashBufferBinary,
  hashBufferRaw,
  hashPdfByteRanges,
  hashString,
  isCertificateValid,
  loadCertOnlyFromPem,
  loadCertificateFromPem,
  parseTimestampTokenTime,
  pkcs7DerToHexPadded,
  randomHex,
  rsaSign,
  rsaVerify,
  safeCompare,
  signHmac,
  verifyCertificateSignature,
  verifyHmac,
  verifyPKCS7Signature
});
