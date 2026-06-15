import type { Metadata } from "next";
import { Inter, Dancing_Script } from "next/font/google";
import { Toaster } from "react-hot-toast";
import "../styles/globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const dancingScript = Dancing_Script({
  subsets: ["latin"],
  variable: "--font-dancing",
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "Sign Document — pdf-signature",
  description: "Legally binding electronic signature powered by pdf-signature",
  robots: { index: false, follow: false }, // Don't index signing pages
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${dancingScript.variable}`}>
      <body className="bg-gradient-to-br from-slate-50 to-blue-50 min-h-screen font-sans antialiased">
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#1e293b",
              color: "#f1f5f9",
              borderRadius: "12px",
              padding: "12px 20px",
            },
            success: { iconTheme: { primary: "#22c55e", secondary: "#f1f5f9" } },
            error: { iconTheme: { primary: "#ef4444", secondary: "#f1f5f9" } },
          }}
        />
        {children}
      </body>
    </html>
  );
}
