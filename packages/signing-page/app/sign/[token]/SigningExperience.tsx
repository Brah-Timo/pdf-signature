"use client";

/**
 * Signing Experience — Client Component
 *
 * The full interactive signing UI:
 * - Method selection (draw / type / upload)
 * - Signature canvas
 * - Legal consent and confirmation
 * - Submission to API
 */

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import SignaturePad from "../../../components/SignaturePad";
import TypedSignature from "../../../components/TypedSignature";
import UploadSignature from "../../../components/UploadSignature";
import AuditInfo from "../../../components/AuditInfo";
import { submitSignature } from "../../../lib/api";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type SignatureMethod = "draw" | "type" | "upload";

interface SigningExperienceProps {
  token: string;
  signatureId: string;
  signerEmail: string;
  signerName?: string;
  documentTitle: string;
  legalStandard: string;
  signatureLevel: string;
  signaturePosition?: { page: number; x: number; y: number; width?: number; height?: number };
  locale: string;
  brandLogoUrl?: string;
  brandColor?: string;
  requireNameConfirmation?: boolean;
  expiresAt: string;
}

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function SigningExperience(props: SigningExperienceProps) {
  const {
    token, signerEmail, signerName, documentTitle,
    legalStandard, signatureLevel, locale, brandLogoUrl, brandColor,
    requireNameConfirmation,
  } = props;

  const [method, setMethod] = useState<SignatureMethod>("draw");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [nameConfirmation, setNameConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [step, setStep] = useState<"sign" | "confirm" | "done">("sign");

  const isRtl = locale === "ar";
  const displayName = signerName ?? signerEmail;

  // ─── Method tabs config ───────────────────────────────────────────────────
  const methods: { id: SignatureMethod; label: string; icon: string }[] = [
    { id: "draw", label: locale === "ar" ? "رسم" : "Draw", icon: "✍️" },
    { id: "type", label: locale === "ar" ? "كتابة" : "Type", icon: "⌨️" },
    { id: "upload", label: locale === "ar" ? "رفع صورة" : "Upload", icon: "📎" },
  ];

  // ─── Handle signature from each method ───────────────────────────────────
  const handleSignatureReady = useCallback((data: string) => {
    setSignatureData(data);
  }, []);

  // ─── Submit signature ─────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!signatureData) {
      toast.error(
        locale === "ar"
          ? "الرجاء إضافة توقيعك أولاً"
          : "Please add your signature first"
      );
      return;
    }

    if (requireNameConfirmation && !nameConfirmation.trim()) {
      toast.error(
        locale === "ar"
          ? "الرجاء كتابة اسمك للتأكيد"
          : "Please type your name to confirm"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitSignature({
        token,
        signatureImage: signatureData,
        deviceInfo: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          screenResolution: `${screen.width}x${screen.height}`,
          timestamp: new Date().toISOString(),
        },
      });

      setDownloadUrl(result.downloadUrl);
      setIsCompleted(true);
      setStep("done");

      toast.success(
        locale === "ar"
          ? "تم التوقيع بنجاح! ✅"
          : "Signed successfully! ✅"
      );
    } catch (error) {
      console.error("Signing failed:", error);
      toast.error(
        locale === "ar"
          ? "حدث خطأ أثناء التوقيع. يرجى المحاولة مرة أخرى."
          : "Signing failed. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [signatureData, requireNameConfirmation, nameConfirmation, token, locale]);

  // ─── Completed State ──────────────────────────────────────────────────────
  if (isCompleted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center"
        >
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-800 mb-2">
            {locale === "ar" ? "تم التوقيع بنجاح!" : "Signed Successfully!"}
          </h1>
          <p className="text-slate-500 mb-6">
            {locale === "ar"
              ? `تم توقيع "${documentTitle}" بنجاح وسيتم إرسال نسخة للطرفين.`
              : `"${documentTitle}" has been signed. Both parties will receive a copy.`}
          </p>

          <div className="bg-slate-50 rounded-xl p-4 mb-6 text-left text-sm text-slate-600 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              <span>Cryptographic signature embedded (PKCS#7)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              <span>Trusted timestamp (RFC 3161)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              <span>{legalStandard} compliant · {signatureLevel}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-500">✓</span>
              <span>Audit trail recorded</span>
            </div>
          </div>

          {downloadUrl && (
            <a
              href={downloadUrl}
              download
              className="block w-full py-3 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold transition-colors mb-3 text-center"
            >
              {locale === "ar" ? "تنزيل المستند الموقّع" : "Download Signed Document"}
            </a>
          )}

          <p className="text-xs text-slate-400">
            {locale === "ar"
              ? "ستتلقى نسخة على بريدك الإلكتروني قريباً"
              : "A copy will be sent to your email shortly"}
          </p>
        </motion.div>
      </div>
    );
  }

  // ─── Main Signing UI ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen py-6 px-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-lg mx-auto">

        {/* Header */}
        <div className="text-center mb-6">
          {brandLogoUrl && (
            <img
              src={brandLogoUrl}
              alt="Company logo"
              className="h-10 mx-auto mb-4 object-contain"
            />
          )}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-1.5 text-sm text-slate-600 shadow-sm mb-4">
            <span>📄</span>
            <span className="font-medium truncate max-w-[200px]">{documentTitle}</span>
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            {locale === "ar"
              ? `مرحباً ${displayName}`
              : `Hello, ${displayName}`}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {locale === "ar"
              ? "وقّع المستند بطريقة قانونياً ملزمة"
              : "Sign this document legally and securely"}
          </p>
        </div>

        {/* Security badges */}
        <div className="flex items-center justify-center gap-2 flex-wrap mb-6">
          <span className="security-badge">🔒 256-bit Encrypted</span>
          <span className="security-badge">⚖️ {legalStandard}</span>
          <span className="security-badge">🏅 {signatureLevel}</span>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">

          {/* Method selector */}
          <div className="flex p-2 gap-1 bg-slate-50 border-b border-slate-100">
            {methods.map((m) => (
              <button
                key={m.id}
                onClick={() => { setMethod(m.id); setSignatureData(null); }}
                className={`method-tab flex-1 flex items-center justify-center gap-1.5 ${
                  method === m.id ? "active" : ""
                }`}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Signature area */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {method === "draw" && (
                <motion.div
                  key="draw"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <SignaturePad
                    onSignatureChange={handleSignatureReady}
                    locale={locale}
                  />
                </motion.div>
              )}
              {method === "type" && (
                <motion.div
                  key="type"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <TypedSignature
                    signerName={displayName}
                    onSignatureChange={handleSignatureReady}
                    locale={locale}
                  />
                </motion.div>
              )}
              {method === "upload" && (
                <motion.div
                  key="upload"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <UploadSignature
                    onSignatureChange={handleSignatureReady}
                    locale={locale}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Name confirmation field (optional) */}
            {requireNameConfirmation && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  {locale === "ar"
                    ? "اكتب اسمك الكامل للتأكيد"
                    : "Type your full name to confirm"}
                </label>
                <input
                  type="text"
                  value={nameConfirmation}
                  onChange={(e) => setNameConfirmation(e.target.value)}
                  placeholder={displayName}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                />
              </div>
            )}

            {/* Audit info */}
            <AuditInfo signerEmail={signerEmail} locale={locale} />

            {/* Legal notice */}
            <div className="legal-notice mt-4 px-2">
              <p>
                {locale === "ar"
                  ? `بالنقر على "تأكيد التوقيع" أنت تقرّ بأن هذا التوقيع الإلكتروني ملزم قانونياً وفق معيار ${legalStandard}.`
                  : `By clicking "Confirm Signature", you agree that this electronic signature is legally binding under ${legalStandard}.`}
              </p>
            </div>
          </div>

          {/* Submit */}
          <div className="px-6 pb-6">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !signatureData}
              className="submit-button"
              style={brandColor ? { background: `linear-gradient(to right, ${brandColor}, ${brandColor}dd)` } : {}}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {locale === "ar" ? "جارٍ التوقيع..." : "Signing..."}
                </span>
              ) : (
                locale === "ar" ? "✅ تأكيد التوقيع" : "✅ Confirm Signature"
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-400 mt-4">
          Secured by{" "}
          <a
            href="https://pdf-signature.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            pdf-signature
          </a>
        </p>
      </div>
    </div>
  );
}
