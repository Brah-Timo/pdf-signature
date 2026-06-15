"use client";

/**
 * UploadSignature Component
 *
 * Allows signers to upload an image of their handwritten signature.
 * Accepts PNG, JPG, SVG files up to 5MB.
 * Shows a preview with background removal hint.
 */

import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface UploadSignatureProps {
  onSignatureChange: (dataUrl: string | null) => void;
  locale?: string;
}

export default function UploadSignature({
  onSignatureChange,
  locale = "en",
}: UploadSignatureProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      setError(null);
      setIsProcessing(true);

      try {
        // Convert to base64 data URL
        const dataUrl = await readFileAsDataUrl(file);
        setPreview(dataUrl);
        onSignatureChange(dataUrl);
      } catch (err) {
        setError(
          locale === "ar"
            ? "فشل في قراءة الملف. الرجاء المحاولة مرة أخرى."
            : "Failed to read file. Please try again."
        );
      } finally {
        setIsProcessing(false);
      }
    },
    [onSignatureChange, locale]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      onDrop,
      accept: {
        "image/png": [".png"],
        "image/jpeg": [".jpg", ".jpeg"],
        "image/svg+xml": [".svg"],
        "image/webp": [".webp"],
      },
      maxSize: 5 * 1024 * 1024, // 5MB
      maxFiles: 1,
      onDropRejected: (rejections) => {
        const rejection = rejections[0];
        if (rejection?.errors[0]?.code === "file-too-large") {
          setError(
            locale === "ar"
              ? "حجم الملف كبير جداً. الحد الأقصى 5MB."
              : "File is too large. Maximum size is 5MB."
          );
        } else if (rejection?.errors[0]?.code === "file-invalid-type") {
          setError(
            locale === "ar"
              ? "نوع الملف غير مدعوم. استخدم PNG أو JPG أو SVG."
              : "Unsupported file type. Use PNG, JPG, or SVG."
          );
        }
      },
    });

  const handleRemove = () => {
    setPreview(null);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-slate-700">
        {locale === "ar" ? "رفع صورة التوقيع" : "Upload signature image"}
      </label>

      {!preview ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
            isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100"
          }`}
        >
          <input {...getInputProps()} />

          <div className="flex flex-col items-center gap-3">
            {isProcessing ? (
              <svg className="animate-spin h-8 w-8 text-blue-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : isDragActive ? (
              <svg className="h-10 w-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            ) : (
              <svg className="h-10 w-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}

            <div>
              <p className="font-medium text-slate-700 text-sm">
                {isDragActive
                  ? locale === "ar" ? "أفلت الملف هنا" : "Drop your file here"
                  : locale === "ar" ? "اسحب وأفلت أو اضغط للاختيار" : "Drag & drop or click to select"}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {locale === "ar" ? "PNG، JPG، SVG — حتى 5MB" : "PNG, JPG, SVG — up to 5MB"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="relative border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
          {/* Preview */}
          <div className="p-4 flex items-center justify-center min-h-[120px]">
            <img
              src={preview}
              alt="Signature preview"
              className="max-h-[100px] max-w-full object-contain"
              style={{ mixBlendMode: "multiply" }}
            />
          </div>

          {/* Remove button */}
          <button
            onClick={handleRemove}
            className="absolute top-2 right-2 w-7 h-7 bg-red-100 hover:bg-red-200 text-red-500 rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Success badge */}
          <div className="px-4 pb-3">
            <span className="security-badge text-xs">
              ✓ {locale === "ar" ? "تم رفع التوقيع" : "Signature uploaded"}
            </span>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 flex items-center gap-1">
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </p>
      )}

      <p className="text-xs text-slate-400">
        {locale === "ar"
          ? "استخدم صورة واضحة لتوقيعك على خلفية بيضاء أو شفافة"
          : "Use a clear image of your signature on a white or transparent background"}
      </p>
    </div>
  );
}

// ── Helper ──────────────────────────────────────────────────────────────────

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
