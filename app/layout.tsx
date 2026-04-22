import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/lib/providers/Providers";

export const metadata: Metadata = {
  title: "Nexus — Verified Resource Allocation for NGOs & Organizations",
  description:
    "Nexus connects verified NGOs and organizations to allocate resources transparently — from emergency flood relief to long-term education programs. Government-verified, AI-matched, audit-chained.",
  keywords: ["NGO", "resource allocation", "disaster relief", "Nexus", "India", "social good"],
  openGraph: {
    title: "Nexus — Connect Resources to Real Needs",
    description: "A transparent platform for NGOs and organizations to allocate verified resources.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@400;600;700;800&family=Geist+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
