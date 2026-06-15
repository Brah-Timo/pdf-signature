/**
 * pdf-signature — Core Package Tests
 * Tests for pdfSign(), pdfVerify(), and pdfMultiSign()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pdfSign } from "../pdfSign.js";
import { pdfVerify } from "../pdfVerify.js";
import { pdfMultiSign, getMultiSignStatus } from "../pdfMultiSign.js";
import { configure, _resetConfig } from "../config.js";
import {
  ValidationError,
  QuotaExceededError,
  AuthenticationError,
  PdfSignResult,
  PdfVerifyResult,
  PdfMultiSignResult,
} from "../types.js";

// ─────────────────────────────────────────────
// Mocking: http module
// ─────────────────────────────────────────────

vi.mock("../http.js", () => ({
  httpRequest: vi.fn(),
  preparePdfPayload: vi.fn().mockResolvedValue({
    base64: "JVBER...(mock base64 PDF data)...",
    mimeType: "application/pdf",
    fileName: "test-contract.pdf",
  }),
}));

import { httpRequest } from "../http.js";
const mockHttpRequest = vi.mocked(httpRequest);

// ─────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────

const MOCK_SIGN_RESPONSE: PdfSignResult = {
  success: true,
  signatureId: "sig_8f3a9c2d1e4b7a6f",
  signingUrl: "https://sign.pdf-signature.dev/s/eyJhbGci...",
  expiresAt: "2025-08-17T14:30:00.000Z",
  status: "pending",
  auditTrailId: "audit_5c8e2f1a9d3b4c7e",
  estimatedCompletionSeconds: null,
};

const MOCK_VERIFY_RESPONSE: PdfVerifyResult = {
  valid: true,
  signatures: [
    {
      signerEmail: "ali@company.com",
      signerName: "Ali Al-Ghamdi",
      signedAt: "2025-08-15T09:22:14.000Z",
      ipAddress: "82.123.45.67",
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      legalStandard: "eIDAS",
      certificateSerial: "3A:9F:C2:7B:11:E4:92:DA",
      timestampAuthority: "DigiCert Timestamp CA",
      integrityCheck: "PASSED",
      level: "AdES-B-T",
      timestampValid: true,
      certificateValid: true,
    },
  ],
  documentHash: "sha256:e3b0c44298fc1c149afb4c8996fb92427ae41e4649b934ca495991b7852b855",
  legallyBinding: true,
  complianceReport: "https://cdn.pdf-signature.dev/reports/sig_8f3a9c2d1e4b7a6f.pdf",
};

const MOCK_MULTI_SIGN_RESPONSE: PdfMultiSignResult = {
  success: true,
  sessionId: "msign_a1b2c3d4e5f67890",
  signers: [
    {
      email: "ali@company.com",
      name: "Ali Al-Ghamdi",
      order: 1,
      role: "Party A",
      status: "pending",
      signingUrl: "https://sign.pdf-signature.dev/s/token1",
      expiresAt: "2025-08-17T14:30:00.000Z",
    },
    {
      email: "sara@partner.com",
      name: "Sara Al-Shehri",
      order: 2,
      role: "Party B",
      status: "pending",
      expiresAt: "2025-08-17T14:30:00.000Z",
    },
  ],
  overallStatus: "in_progress",
  nextSignerEmail: "ali@company.com",
  completedCount: 0,
  totalCount: 2,
  auditTrailId: "audit_multi_abc123",
};

// ─────────────────────────────────────────────
// Setup / Teardown
// ─────────────────────────────────────────────

beforeEach(() => {
  _resetConfig();
  configure({ apiKey: "pdf_test_key_for_unit_testing_only" });
  vi.clearAllMocks();
});

afterEach(() => {
  vi.resetAllMocks();
});

// ═════════════════════════════════════════════════════════════════════════════
// pdfSign() Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("pdfSign()", () => {
  describe("✅ Success cases", () => {
    it("returns signatureId, signingUrl, and status=pending on success", async () => {
      mockHttpRequest.mockResolvedValueOnce(MOCK_SIGN_RESPONSE);

      const result = await pdfSign("contract.pdf", {
        signer: "ali@company.com",
        legal: "eIDAS",
      });

      expect(result.success).toBe(true);
      expect(result.signatureId).toMatch(/^sig_[a-f0-9]{16}$/);
      expect(result.signingUrl).toContain("sign.pdf-signature.dev");
      expect(result.status).toBe("pending");
      expect(result.auditTrailId).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it("accepts a Buffer instead of a file path", async () => {
      mockHttpRequest.mockResolvedValueOnce(MOCK_SIGN_RESPONSE);

      const fakeBuffer = Buffer.from("%PDF-1.4 fake pdf content for testing");
      const result = await pdfSign(fakeBuffer, {
        signer: "test@example.com",
      });

      expect(result.success).toBe(true);
    });

    it("sends all optional fields to the API", async () => {
      mockHttpRequest.mockResolvedValueOnce(MOCK_SIGN_RESPONSE);

      await pdfSign("contract.pdf", {
        signer: "ali@company.com",
        signerName: "Ali Al-Ghamdi",
        legal: "KSA-ETL",
        message: "Please sign this contract.",
        expiresIn: 48,
        webhookUrl: "https://myapp.com/webhooks/signed",
        signaturePosition: { page: 1, x: 400, y: 100, width: 200, height: 60 },
        signatureLevel: "AdES-B-LT",
        metadata: { contractId: "CNT-2025-042", amount: 5000 },
        locale: "ar",
      });

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
          url: "/v1/sign",
          data: expect.objectContaining({
            signerEmail: "ali@company.com",
            signerName: "Ali Al-Ghamdi",
            legal: "KSA-ETL",
            expiresIn: 48,
            signatureLevel: "AdES-B-LT",
          }),
        })
      );
    });

    it("defaults legal to eIDAS when not specified", async () => {
      mockHttpRequest.mockResolvedValueOnce(MOCK_SIGN_RESPONSE);

      await pdfSign("contract.pdf", { signer: "test@email.com" });

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ legal: "eIDAS" }),
        })
      );
    });

    it("defaults expiresIn to 72 hours when not specified", async () => {
      mockHttpRequest.mockResolvedValueOnce(MOCK_SIGN_RESPONSE);
      await pdfSign("contract.pdf", { signer: "test@email.com" });

      expect(mockHttpRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ expiresIn: 72 }),
        })
      );
    });
  });

  describe("❌ Validation errors", () => {
    it("throws ValidationError for invalid email address", async () => {
      await expect(
        pdfSign("contract.pdf", { signer: "not-an-email" })
      ).rejects.toThrow(ValidationError);

      await expect(
        pdfSign("contract.pdf", { signer: "not-an-email" })
      ).rejects.toThrow("Invalid signer email address");
    });

    it("throws ValidationError for empty signer email", async () => {
      await expect(
        pdfSign("contract.pdf", { signer: "" })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for invalid legal standard", async () => {
      await expect(
        pdfSign("contract.pdf", {
          signer: "test@email.com",
          legal: "INVALID_STANDARD" as never,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for expiresIn below minimum (1)", async () => {
      await expect(
        pdfSign("contract.pdf", {
          signer: "test@email.com",
          expiresIn: 0,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for expiresIn above maximum (720)", async () => {
      await expect(
        pdfSign("contract.pdf", {
          signer: "test@email.com",
          expiresIn: 721,
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for non-HTTPS webhookUrl", async () => {
      await expect(
        pdfSign("contract.pdf", {
          signer: "test@email.com",
          webhookUrl: "http://insecure.com/webhook",
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for invalid E.164 phone number", async () => {
      await expect(
        pdfSign("contract.pdf", {
          signer: "test@email.com",
          smsNotify: "0501234567", // Missing country code
        })
      ).rejects.toThrow(ValidationError);
    });

    it("throws ValidationError for invalid brandColor format", async () => {
      await expect(
        pdfSign("contract.pdf", {
          signer: "test@email.com",
          brandColor: "red", // Should be #hex
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("🔐 API errors", () => {
    it("propagates QuotaExceededError from API", async () => {
      mockHttpRequest.mockRejectedValueOnce(new QuotaExceededError());

      await expect(
        pdfSign("contract.pdf", { signer: "test@email.com" })
      ).rejects.toThrow(QuotaExceededError);
    });

    it("propagates AuthenticationError from API", async () => {
      mockHttpRequest.mockRejectedValueOnce(
        new AuthenticationError("Invalid API key")
      );

      await expect(
        pdfSign("contract.pdf", { signer: "test@email.com" })
      ).rejects.toThrow(AuthenticationError);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// pdfVerify() Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("pdfVerify()", () => {
  it("returns valid=true for a properly signed document", async () => {
    mockHttpRequest.mockResolvedValueOnce(MOCK_VERIFY_RESPONSE);

    const result = await pdfVerify("signed-contract.pdf");

    expect(result.valid).toBe(true);
    expect(result.legallyBinding).toBe(true);
    expect(result.signatures).toHaveLength(1);
    expect(result.signatures[0]?.integrityCheck).toBe("PASSED");
    expect(result.signatures[0]?.signerEmail).toBe("ali@company.com");
  });

  it("returns valid=false for a tampered document", async () => {
    mockHttpRequest.mockResolvedValueOnce({
      ...MOCK_VERIFY_RESPONSE,
      valid: false,
      legallyBinding: false,
      signatures: [
        {
          ...MOCK_VERIFY_RESPONSE.signatures[0],
          integrityCheck: "FAILED",
        },
      ],
    });

    const result = await pdfVerify("tampered.pdf");

    expect(result.valid).toBe(false);
    expect(result.signatures[0]?.integrityCheck).toBe("FAILED");
  });

  it("verifies by signatureId (remote lookup)", async () => {
    mockHttpRequest.mockResolvedValueOnce(MOCK_VERIFY_RESPONSE);

    const result = await pdfVerify({ signatureId: "sig_8f3a9c2d1e4b7a6f" });

    expect(result.valid).toBe(true);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: expect.stringContaining("/v1/verify/sig_8f3a9c2d1e4b7a6f"),
      })
    );
  });

  it("throws ValidationError for invalid signatureId format", async () => {
    await expect(
      pdfVerify({ signatureId: "not_a_valid_id" })
    ).rejects.toThrow(ValidationError);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// pdfMultiSign() Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("pdfMultiSign()", () => {
  it("returns sessionId and signers array on success", async () => {
    mockHttpRequest.mockResolvedValueOnce(MOCK_MULTI_SIGN_RESPONSE);

    const result = await pdfMultiSign("partnership.pdf", {
      signers: [
        { email: "ali@company.com", name: "Ali", order: 1, role: "Party A" },
        { email: "sara@partner.com", name: "Sara", order: 2, role: "Party B" },
      ],
      legal: "eIDAS",
    });

    expect(result.success).toBe(true);
    expect(result.sessionId).toMatch(/^msign_/);
    expect(result.signers).toHaveLength(2);
    expect(result.nextSignerEmail).toBe("ali@company.com");
    expect(result.overallStatus).toBe("in_progress");
  });

  it("throws ValidationError for fewer than 2 signers", async () => {
    await expect(
      pdfMultiSign("contract.pdf", {
        signers: [
          { email: "ali@company.com", order: 1 },
        ],
      })
    ).rejects.toThrow(ValidationError);

    await expect(
      pdfMultiSign("contract.pdf", {
        signers: [{ email: "ali@company.com", order: 1 }],
      })
    ).rejects.toThrow("at least 2 signers");
  });

  it("throws ValidationError for more than 20 signers", async () => {
    const tooManySigners = Array.from({ length: 21 }, (_, i) => ({
      email: `signer${i}@company.com`,
      order: i + 1,
    }));

    await expect(
      pdfMultiSign("contract.pdf", { signers: tooManySigners })
    ).rejects.toThrow(ValidationError);
  });

  it("throws ValidationError for duplicate order values", async () => {
    await expect(
      pdfMultiSign("contract.pdf", {
        signers: [
          { email: "ali@company.com", order: 1 },
          { email: "sara@partner.com", order: 1 }, // Duplicate!
        ],
      })
    ).rejects.toThrow("unique order value");
  });

  it("throws ValidationError for duplicate email addresses", async () => {
    await expect(
      pdfMultiSign("contract.pdf", {
        signers: [
          { email: "same@email.com", order: 1 },
          { email: "same@email.com", order: 2 }, // Duplicate email!
        ],
      })
    ).rejects.toThrow("unique email address");
  });

  it("sorts signers by order before sending to API", async () => {
    mockHttpRequest.mockResolvedValueOnce(MOCK_MULTI_SIGN_RESPONSE);

    await pdfMultiSign("contract.pdf", {
      signers: [
        { email: "third@company.com", order: 3 },
        { email: "first@company.com", order: 1 },
        { email: "second@company.com", order: 2 },
      ],
    });

    const callArgs = mockHttpRequest.mock.calls[0]?.[0];
    const sentSigners = (callArgs as { data: { signers: { email: string; order: number }[] } })
      ?.data?.signers;
    expect(sentSigners?.[0]?.email).toBe("first@company.com");
    expect(sentSigners?.[1]?.email).toBe("second@company.com");
    expect(sentSigners?.[2]?.email).toBe("third@company.com");
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SDK Configuration Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("SDK Configuration", () => {
  it("throws AuthenticationError when no API key is configured", () => {
    _resetConfig();
    delete process.env["PDF_SIGN_API_KEY"];
    delete process.env["PDF_SIGNATURE_API_KEY"];

    expect(() =>
      pdfSign("contract.pdf", { signer: "test@email.com" })
    ).toThrow(AuthenticationError);
  });

  it("reads API key from PDF_SIGN_API_KEY env variable", () => {
    _resetConfig();
    process.env["PDF_SIGN_API_KEY"] = "pdf_live_from_env";

    // Should not throw
    expect(() => pdfSign).not.toThrow();
  });
});
