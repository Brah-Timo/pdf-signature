/**
 * Signing Page — API Client
 *
 * Calls the API server from the signing page.
 */

const API_BASE_URL =
  process.env["NEXT_PUBLIC_API_URL"] ??
  process.env["API_BASE_URL"] ??
  "https://api.pdf-signature.dev";

export interface SubmitSignatureRequest {
  token: string;
  signatureImage: string;
  deviceInfo: {
    userAgent: string;
    language: string;
    timezone: string;
    screenResolution: string;
    timestamp: string;
  };
}

export interface SubmitSignatureResponse {
  success: true;
  message: string;
  downloadUrl: string;
  signedAt: string;
}

/**
 * Submit the completed signature to the API server.
 * Called when the signer clicks "Confirm Signature".
 */
export async function submitSignature(
  data: SubmitSignatureRequest
): Promise<SubmitSignatureResponse> {
  const response = await fetch(`${API_BASE_URL}/v1/sign/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({
      message: "Unknown error",
    }));
    throw new Error(
      (error as { message?: string }).message ??
      `HTTP ${response.status}: Failed to submit signature`
    );
  }

  return response.json() as Promise<SubmitSignatureResponse>;
}

/**
 * Get the PDF for preview in the signing page.
 */
export async function getSigningDocument(token: string): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/v1/sign/document?token=${token}`);

  if (!response.ok) {
    throw new Error(`Failed to load document: HTTP ${response.status}`);
  }

  return response.blob();
}
