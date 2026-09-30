import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./redesign.css";
import { isPreviewMode } from "@/lib/preview-mode";
import { PreviewApp } from "@/components/preview-app";

export const metadata: Metadata = {
  title: {
    default: "Pick Five",
    template: "%s · Pick Five",
  },
  description: "A private, mobile-first NFL against-the-spread Pick Five pool.",
  applicationName: "Pick Five",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#10281f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{isPreviewMode() ? <PreviewApp /> : null}{children}</body>
    </html>
  );
}
