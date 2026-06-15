---
id: legal-compliance
title: Legal Compliance
sidebar_label: Legal Compliance
slug: /legal-compliance
description: How pdf-signature meets eIDAS, KSA-ETL, ESIGN, and UETA standards for legally binding electronic signatures.
---

# Legal Compliance

pdf-signature produces **Advanced Electronic Signatures (AdES)** that are legally binding across 27 EU member states (eIDAS), the United States (ESIGN/UETA), Saudi Arabia (KSA-ETL), and any jurisdiction that accepts X.509-based digital signatures.

## Standards supported

| Standard | Jurisdiction | Level achieved |
|----------|-------------|----------------|
| **eIDAS** EU 910/2014 | European Union (27 states) + UK | AdES-B-LT |
| **KSA-ETL** | Kingdom of Saudi Arabia | Advanced |
| **ESIGN** | United States (federal) | Advanced |
| **UETA** | United States (state-level) | Advanced |

## What makes a signature legally binding?

Under eIDAS Article 26, an **Advanced Electronic Signature** must:

1. **Be uniquely linked to the signatory** — achieved via ephemeral X.509 certificate bound to the signer's email
2. **Be capable of identifying the signatory** — Audit Trail records email, IP, device fingerprint, user-agent
3. **Be created using data under the signatory's sole control** — the private key is generated fresh per signature and never persisted
4. **Be linked to the signed data in such a way that any change is detectable** — PKCS#7 detached signature covers the full Byte Range of the PDF; any modification breaks the digest

pdf-signature achieves **AdES-B-LT** (the highest non-qualified level), meaning:

- **AdES-B**: Base-line signature with signing certificate
- **AdES-B-T**: Includes a trusted timestamp from DigiCert (RFC 3161)
- **AdES-B-LT**: Certificate revocation data (OCSP/CRL) embedded — long-term validity even if the CA later goes offline

## Cryptographic stack

```
Signature format:    PKCS#7 CMS SignedData (detached)
Hash algorithm:      SHA-256
Key algorithm:       RSA-2048
Certificate type:    X.509 v3 (ephemeral, per-signature)
Timestamp authority: DigiCert TSA (RFC 3161)
Timestamp hash:      SHA-256
PDF embedding:       Byte Range approach (ISO 32000-1 §12.8)
Visual signature:    Embedded PNG + metadata annotation
```

## Audit Trail

Every signature generates an immutable Audit Trail containing:

| Field | Value | Purpose |
|-------|-------|---------|
| `signerEmail` | Verified email address | Identifies signatory |
| `intentConfirmedAt` | ISO 8601 timestamp | Proves moment of intent |
| `ipAddress` | IPv4/IPv6 | Geolocation evidence |
| `userAgent` | Browser + OS string | Device evidence |
| `documentHashBefore` | SHA-256 | Document integrity before signing |
| `documentHashAfter` | SHA-256 | Document integrity after signing |
| `pkcs7SignatureHex` | Hex-encoded DER | Full cryptographic proof |
| `certificateChain` | PEM array | Chain of trust |
| `timestampToken` | RFC 3161 hex | Trusted timestamp |
| `legalStandard` | String | Applied regulation |
| `regulatoryReference` | String | e.g. "EU Regulation 910/2014, Article 26" |

## Saudi Arabia — نظام المعاملات الإلكترونية

Under Royal Decree No. (M/18) of 1428H (2007), electronic signatures backed by X.509 certificates issued by an accredited Certification Service Provider are legally binding.

pdf-signature's signatures qualify under Article 5 of the Electronic Transactions Law because:
- They use a digital certificate linked to the signatory's identity
- The private key is under the signatory's sole control during signing
- The document hash is cryptographically linked to the signature
- A trusted timestamp proves the time of signing

## Certificate chain of trust

```
Root CA (DigiCert Global Root)
    └── pdf-signature Intermediate CA
            └── Ephemeral Signer Certificate
                  Subject: CN=<signerName>, email=<signerEmail>
                  KeyUsage: digitalSignature, nonRepudiation
                  ExtKeyUsage: emailProtection, id-adobe-pdf-signing
                  Validity: 1 hour (for signing only)
```

The Intermediate CA certificate is embedded in every signature, enabling offline verification decades from now without relying on pdf-signature's servers.

## Non-repudiation

Non-repudiation is achieved through three independent layers:

1. **Knowledge** — Only the signer knows their inbox; they must click the link sent to their verified email
2. **Technical** — The private key is generated in-browser, signs the document, and is never transmitted or stored
3. **Temporal** — The RFC 3161 timestamp from DigiCert proves the exact time of signing, independent of pdf-signature's clocks

## GDPR / Privacy

pdf-signature is GDPR-compliant:
- **Data minimisation**: Only the minimum data needed for legal validity is stored
- **Right to erasure**: Encrypted documents are deleted after the configured retention period (30 days for Free, 5 years for Pro)
- **Data processing agreement**: Available for Pro and Enterprise customers
- **Data residency**: EU-hosted option available for Enterprise customers

## Qualified Electronic Signatures (QES)

QES requires a **Qualified Certificate** issued by a **Qualified Trust Service Provider (QTSP)** listed in the EU Trust List, used with a **Qualified Signature Creation Device (QSCD)** such as a hardware security module (HSM) or smart card.

pdf-signature currently supports AdES-B-LT (non-qualified advanced). QES support with HSM integration is available for Enterprise customers. [Contact sales →](mailto:enterprise@pdf-signature.dev)

## Frequently asked questions

<details>
<summary>Is an eIDAS Advanced signature admissible in court?</summary>

Yes. Under eIDAS Article 25(1), an electronic signature shall not be denied legal effect solely on the grounds that it is in electronic form. AdES-B-LT signatures have a presumption of integrity under Article 26.

</details>

<details>
<summary>What if the signer disputes signing?</summary>

The Audit Trail, PKCS#7 signature, and RFC 3161 timestamp together provide strong non-repudiation. The signer must demonstrate either that (a) their email was compromised or (b) the cryptographic signature is invalid — both highly verifiable claims. In practice, this evidence has been upheld in EU and US courts.

</details>

<details>
<summary>Can I use pdf-signature for employment contracts?</summary>

Yes, across all supported jurisdictions. Employment contracts are standard contracts and fully covered by eIDAS/ESIGN/UETA. For jurisdictions requiring wet-ink signatures by law (certain notarial acts, land transfers), consult a local legal expert.

</details>

<details>
<summary>How long are signed documents valid?</summary>

AdES-B-LT signatures are designed for long-term validity. The embedded OCSP/CRL responses prove certificate validity at the time of signing, meaning the signature remains legally valid even after the signing certificate's 1-hour validity window — and even if the Intermediate CA is later revoked or expires.

</details>
