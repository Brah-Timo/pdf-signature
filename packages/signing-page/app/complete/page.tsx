/**
 * Signing Complete Page — /complete
 *
 * Shown after a successful signature as a clean confirmation page.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Signing Complete — pdf-signature",
  description: "Your document has been signed successfully",
};

export default function CompletePage({
  searchParams,
}: {
  searchParams: { download?: string; title?: string; locale?: string };
}) {
  const downloadUrl = searchParams.download;
  const documentTitle = searchParams.title ?? "Document";
  const locale = searchParams.locale ?? "en";
  const isAr = locale === "ar";

  return (
    <div className="min-h-screen flex items-center justify-center p-4" dir={isAr ? "rtl" : "ltr"}>
      <div className="max-w-md w-full text-center">

        {/* Success animation */}
        <div className="w-24 h-24 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-200">
          <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-slate-800 mb-3">
          {isAr ? "تم التوقيع بنجاح!" : "Signing Complete!"}
        </h1>

        <p className="text-slate-500 mb-8 leading-relaxed">
          {isAr
            ? `تم توقيع "${documentTitle}" بتوقيع إلكتروني ملزم قانونياً. ستتلقى نسخة على بريدك الإلكتروني.`
            : `"${documentTitle}" has been signed with a legally binding electronic signature. A copy has been sent to your email.`}
        </p>

        {/* What happened */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 text-left space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide mb-4">
            {isAr ? "ما تم" : "What happened"}
          </h2>
          {[
            {
              icon: "🔐",
              title: isAr ? "توقيع رقمي PKCS#7" : "PKCS#7 Digital Signature",
              desc: isAr ? "تم تضمينه في ملف PDF" : "Embedded in the PDF file",
            },
            {
              icon: "⏰",
              title: isAr ? "ختم وقت RFC 3161" : "RFC 3161 Timestamp",
              desc: isAr ? "من DigiCert — وقت التوقيع موثّق" : "From DigiCert — signing time is certified",
            },
            {
              icon: "🔒",
              title: isAr ? "سجل تدقيق كامل" : "Complete Audit Trail",
              desc: isAr ? "IP، الجهاز، الموقع — مسجّل" : "IP, device, location — all recorded",
            },
            {
              icon: "⚖️",
              title: isAr ? "امتثال قانوني" : "Legal Compliance",
              desc: isAr ? "ملزم بموجب eIDAS + نظام المعاملات الإلكترونية" : "Binding under eIDAS + KSA-ETL",
            },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="text-lg flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-medium text-slate-700 text-sm">{item.title}</p>
                <p className="text-slate-400 text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Download button */}
        {downloadUrl && (
          <a
            href={downloadUrl}
            download
            className="block w-full py-3.5 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-semibold transition-colors mb-3 shadow-lg shadow-blue-500/25"
          >
            {isAr ? "⬇️ تنزيل المستند الموقّع" : "⬇️ Download Signed Document"}
          </a>
        )}

        <p className="text-xs text-slate-400">
          {isAr
            ? "يمكنك إغلاق هذه الصفحة بأمان."
            : "You can safely close this page."}
        </p>

        {/* Powered by */}
        <p className="text-xs text-slate-300 mt-6">
          {isAr ? "مدعوم بواسطة " : "Powered by "}
          <a
            href="https://pdf-signature.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-slate-500"
          >
            pdf-signature
          </a>
        </p>
      </div>
    </div>
  );
}
