"use client";

/**
 * AuditInfo Component
 *
 * Shows the signer what information will be recorded in the audit trail.
 * This transparency builds trust and satisfies eIDAS "intent to sign" requirements.
 */

import { useState } from "react";

interface AuditInfoProps {
  signerEmail: string;
  locale?: string;
}

export default function AuditInfo({ signerEmail, locale = "en" }: AuditInfoProps) {
  const [expanded, setExpanded] = useState(false);

  const auditItems = locale === "ar"
    ? [
        { icon: "📧", label: "البريد الإلكتروني", value: signerEmail },
        { icon: "🌐", label: "عنوان IP", value: "سيتم تسجيله" },
        { icon: "📱", label: "المتصفح والجهاز", value: "سيتم تسجيله" },
        { icon: "🕐", label: "التوقيت والمنطقة الزمنية", value: "سيتم تسجيله" },
        { icon: "🔐", label: "شهادة X.509", value: "ستُولَّد خصيصاً لهذا التوقيع" },
        { icon: "⏰", label: "ختم الوقت RFC 3161", value: "من DigiCert TSA" },
      ]
    : [
        { icon: "📧", label: "Email address", value: signerEmail },
        { icon: "🌐", label: "IP address", value: "Will be recorded" },
        { icon: "📱", label: "Browser & device", value: "Will be recorded" },
        { icon: "🕐", label: "Timestamp & timezone", value: "Will be recorded" },
        { icon: "🔐", label: "X.509 certificate", value: "Generated uniquely for this signature" },
        { icon: "⏰", label: "RFC 3161 timestamp", value: "From DigiCert TSA" },
      ];

  return (
    <div className="mt-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors w-full"
      >
        <svg
          className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="font-medium">
          {locale === "ar" ? "ما الذي يتم تسجيله في سجل التدقيق؟" : "What gets recorded in the audit trail?"}
        </span>
      </button>

      {expanded && (
        <div className="mt-2 bg-slate-50 rounded-lg p-3 space-y-1.5">
          {auditItems.map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span>{item.icon}</span>
              <span className="font-medium text-slate-600 min-w-[130px]">{item.label}:</span>
              <span className="text-slate-400">{item.value}</span>
            </div>
          ))}

          <div className="pt-1.5 border-t border-slate-200 mt-1.5">
            <p className="text-xs text-slate-400">
              {locale === "ar"
                ? "هذه البيانات مطلوبة قانونياً لإثبات هوية الموقّع ومنع الإنكار."
                : "This data is legally required to prove signer identity and prevent repudiation."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
