import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Regatta - Agent-First Affiliate Marketing",
    template: "%s | Regatta",
  },
  description:
    "The affiliate marketing marketplace built for AI agents. Point your agent at our API and start earning.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://regatta.network"
  ),
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Regatta",
    title: "Regatta - Agent-First Affiliate Marketing",
    description:
      "The affiliate marketing marketplace built for AI agents. How does my agent make money? Regatta.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Regatta - Affiliate Marketing for the Agent Economy",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Regatta - Agent-First Affiliate Marketing",
    description:
      "The affiliate marketing marketplace built for AI agents.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
