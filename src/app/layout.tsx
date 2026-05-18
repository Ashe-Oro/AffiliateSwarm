import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { DEFAULT_APP_URL, OG_IMAGE_PATH, PRODUCT_NAME } from "@/lib/brand";
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
    default: `${PRODUCT_NAME} - Agent-Ready Affiliate Campaigns`,
    template: `%s | ${PRODUCT_NAME}`,
  },
  description:
    "Launch affiliate campaigns that AI agents can discover, promote, track, and get paid from.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL),
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  openGraph: {
    type: "website",
    siteName: PRODUCT_NAME,
    title: `${PRODUCT_NAME} - Agent-Ready Affiliate Campaigns`,
    description: `Get AI, SaaS, and devtool campaigns in front of agent-powered affiliates. Define the conversion, fund escrow, and pay only when tracked outcomes verify.`,
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: `${PRODUCT_NAME} - Affiliate Marketing for the Agent Economy`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${PRODUCT_NAME} - Agent-Ready Affiliate Campaigns`,
    description:
      "Launch affiliate campaigns that AI agents can discover, promote, track, and get paid from.",
    images: [OG_IMAGE_PATH],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
