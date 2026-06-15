"use client";

/**
 * TypedSignature Component
 *
 * Allows the signer to type their name, which is then rendered
 * in a cursive/handwriting font to create a visual signature.
 * The typed text is converted to a canvas image for submission.
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface TypedSignatureProps {
  signerName: string;
  onSignatureChange: (dataUrl: string | null) => void;
  locale?: string;
}

// Available handwriting fonts (loaded via Google Fonts in layout.tsx)
const SIGNATURE_FONTS = [
  { id: "dancing", name: "Dancing Script", css: "Dancing Script, cursive" },
  { id: "great-vibes", name: "Great Vibes", css: "Great Vibes, cursive" },
  { id: "pacifico", name: "Pacifico", css: "Pacifico, cursive" },
  { id: "satisfy", name: "Satisfy", css: "Satisfy, cursive" },
];

export default function TypedSignature({
  signerName,
  onSignatureChange,
  locale = "en",
}: TypedSignatureProps) {
  const [typedText, setTypedText] = useState(signerName);
  const [selectedFont, setSelectedFont] = useState(SIGNATURE_FONTS[0]!);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // ── Render to canvas whenever text or font changes ──────────────────────────
  const renderToCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !typedText.trim()) {
      onSignatureChange(null);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas dimensions
    const ratio = window.devicePixelRatio || 1;
    canvas.width = 400 * ratio;
    canvas.height = 120 * ratio;
    ctx.scale(ratio, ratio);

    // Clear
    ctx.clearRect(0, 0, 400, 120);

    // Draw signature text
    ctx.font = `60px "${selectedFont.css}"`;
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedText, 200, 60, 380);

    // Draw signature line
    ctx.beginPath();
    ctx.moveTo(10, 100);
    ctx.lineTo(390, 100);
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Export as PNG data URL
    const dataUrl = canvas.toDataURL("image/png");
    onSignatureChange(dataUrl);
  }, [typedText, selectedFont, onSignatureChange]);

  useEffect(() => {
    // Small delay to ensure fonts are loaded
    const timer = setTimeout(renderToCanvas, 100);
    return () => clearTimeout(timer);
  }, [renderToCanvas]);

  return (
    <div className="space-y-4">
      {/* Text input */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          {locale === "ar" ? "اكتب اسمك" : "Type your name"}
        </label>
        <input
          type="text"
          value={typedText}
          onChange={(e) => setTypedText(e.target.value)}
          placeholder={signerName}
          className="typed-signature-input"
          style={{ fontFamily: selectedFont.css, fontSize: "1.8rem" }}
          maxLength={100}
          autoFocus
        />
      </div>

      {/* Preview */}
      {typedText.trim() && (
        <div>
          <p className="text-xs text-slate-500 mb-2">
            {locale === "ar" ? "معاينة التوقيع:" : "Signature preview:"}
          </p>
          <div
            ref={previewRef}
            className="typed-signature-preview bg-slate-50 rounded-xl px-6"
            style={{ fontFamily: selectedFont.css }}
          >
            {typedText}
          </div>
        </div>
      )}

      {/* Font selector */}
      <div>
        <p className="text-xs font-medium text-slate-500 mb-2">
          {locale === "ar" ? "اختر نمط الخط:" : "Choose font style:"}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {SIGNATURE_FONTS.map((font) => (
            <button
              key={font.id}
              onClick={() => setSelectedFont(font)}
              className={`px-3 py-2 rounded-lg border text-sm transition-all ${
                selectedFont.id === font.id
                  ? "border-blue-500 bg-blue-50 text-blue-700"
                  : "border-slate-200 hover:border-slate-300 text-slate-600"
              }`}
              style={{ fontFamily: font.css }}
            >
              {typedText || "Signature"}
            </button>
          ))}
        </div>
      </div>

      {/* Hidden canvas for image generation */}
      <canvas
        ref={canvasRef}
        style={{ display: "none" }}
        width={400}
        height={120}
        aria-hidden="true"
      />
    </div>
  );
}
