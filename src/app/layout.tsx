import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/providers/auth-provider";
import { BRAND } from "@/lib/branding";
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
    default: `${BRAND.productName} TMS`,
    template: `%s · ${BRAND.shortName}`,
  },
  description: `${BRAND.tagline} — transportation management for oilfield, pipe, and flatbed logistics.`,
  applicationName: BRAND.productName,
  icons: {
    icon: [
      { url: BRAND.assets.favicon, type: "image/png", sizes: "64x64" },
      { url: BRAND.assets.favicon32, type: "image/png", sizes: "32x32" },
    ],
    shortcut: BRAND.assets.favicon,
    apple: BRAND.assets.appleTouch,
  },
  appleWebApp: {
    title: BRAND.productName,
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
