/**
 * Signing Page — /sign/[token]
 *
 * Server component that:
 * 1. Validates the JWT token from the URL
 * 2. Extracts signer info and document details
 * 3. Renders the signing experience for the signer
 */

import { notFound, redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import SigningExperience from "./SigningExperience";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

interface SigningTokenPayload {
  signatureId: string;
  signerEmail: string;
  signerName?: string;
  documentTitle: string;
  legalStandard: string;
  signatureLevel: string;
  signaturePosition?: {
    page: number;
    x: number;
    y: number;
    width?: number;
    height?: number;
  };
  locale: string;
  brandLogoUrl?: string;
  brandColor?: string;
  requireNameConfirmation?: boolean;
  exp: number;
}

// ─────────────────────────────────────────────
// Server Component
// ─────────────────────────────────────────────

export default async function SignPage({
  params,
}: {
  params: { token: string };
}) {
  const { token } = params;

  if (!token) {
    notFound();
  }

  // Validate and decode the JWT
  let payload: SigningTokenPayload;
  try {
    payload = jwt.verify(
      token,
      process.env["JWT_SECRET"]!
    ) as SigningTokenPayload;
  } catch (error) {
    const isExpired = (error as Error).name === "TokenExpiredError";
    if (isExpired) {
      redirect(`/expired?reason=expired`);
    }
    notFound();
  }

  // Pass decoded data to client component
  return (
    <SigningExperience
      token={token}
      signatureId={payload.signatureId}
      signerEmail={payload.signerEmail}
      signerName={payload.signerName}
      documentTitle={payload.documentTitle}
      legalStandard={payload.legalStandard}
      signatureLevel={payload.signatureLevel}
      signaturePosition={payload.signaturePosition}
      locale={payload.locale ?? "en"}
      brandLogoUrl={payload.brandLogoUrl}
      brandColor={payload.brandColor}
      requireNameConfirmation={payload.requireNameConfirmation}
      expiresAt={new Date(payload.exp * 1000).toISOString()}
    />
  );
}
