"use client";

/**
 * SignaturePad Component
 *
 * A canvas-based signature drawing component.
 * Uses the 'signature_pad' library for smooth ink-like drawing.
 * Supports mouse, touch, and stylus input.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import SignaturePadLib from "signature_pad";

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  locale?: string;
  penColor?: string;
  backgroundColor?: string;
}

export default function SignaturePad({
  onSignatureChange,
  locale = "en",
  penColor = "#1a1a2e",
  backgroundColor = "rgba(255, 255, 255, 0)",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [isDrawing, setIsDrawing] = useState(false);

  // ── Initialize signature pad ────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      backgroundColor,
      penColor,
      velocityFilterWeight: 0.7,
      minWidth: 0.8,
      maxWidth: 3.0,
      throttle: 0, // No throttle — capture every point for maximum smoothness
    });

    padRef.current = pad;

    // ── Canvas resize observer ─────────────────────────────────────────────
    const resizeCanvas = () => {
      if (!canvas || !padRef.current) return;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();

      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);

      padRef.current.clear();
      setIsEmpty(true);
      onSignatureChange(null);
    };

    const ro = new ResizeObserver(resizeCanvas);
    ro.observe(canvas);

    // Initial sizing
    setTimeout(resizeCanvas, 50);

    // ── Event listeners ────────────────────────────────────────────────────
    const handleBeginStroke = () => setIsDrawing(true);
    const handleEndStroke = () => {
      setIsDrawing(false);
      if (!pad.isEmpty()) {
        setIsEmpty(false);
        const dataUrl = pad.toDataURL("image/png");
        onSignatureChange(dataUrl);
      }
    };

    pad.addEventListener("beginStroke", handleBeginStroke);
    pad.addEventListener("endStroke", handleEndStroke);

    return () => {
      ro.disconnect();
      pad.removeEventListener("beginStroke", handleBeginStroke);
      pad.removeEventListener("endStroke", handleEndStroke);
      pad.off();
    };
  }, [backgroundColor, penColor, onSignatureChange]);

  // ── Clear ───────────────────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    padRef.current?.clear();
    setIsEmpty(true);
    onSignatureChange(null);
  }, [onSignatureChange]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-slate-700">
          {locale === "ar" ? "رسم التوقيع" : "Draw your signature"}
        </label>
        {!isEmpty && (
          <button
            onClick={handleClear}
            className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors"
          >
            {locale === "ar" ? "مسح" : "Clear"}
          </button>
        )}
      </div>

      <div className={`relative rounded-xl overflow-hidden border-2 transition-all duration-200 ${
        isDrawing
          ? "border-blue-500 shadow-blue-100 shadow-md"
          : !isEmpty
          ? "border-blue-300"
          : "border-dashed border-slate-300 hover:border-slate-400"
      }`}>
        <canvas
          ref={canvasRef}
          className="signature-canvas touch-none"
          style={{ height: "180px", display: "block" }}
          aria-label={locale === "ar" ? "لوحة التوقيع" : "Signature drawing area"}
        />

        {isEmpty && !isDrawing && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
            <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span className="text-sm">
              {locale === "ar"
                ? "ارسم توقيعك هنا"
                : "Draw your signature here"}
            </span>
            <span className="text-xs mt-1 opacity-75">
              {locale === "ar" ? "بالماوس أو باللمس" : "Mouse or touch supported"}
            </span>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        {locale === "ar"
          ? "ارسم توقيعك كما تكتبه عادةً"
          : "Sign as you would on a paper document"}
      </p>
    </div>
  );
}
