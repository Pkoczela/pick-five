import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { PreviewToolbar } from "@/components/preview-toolbar";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";

export const metadata: Metadata = {
  title: {
    default: "Pick Five",
    template: "%s · Pick Five",
  },
  description: "A private, mobile-first NFL against-the-spread Pick Five pool.",
  applicationName: "Pick Five",
  ...(isPreviewMode() ? { robots: { index: false, follow: false } } : {}),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#132e25" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1813" },
  ],
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-theme={theme}>
      <body>
        {isPreviewMode() ? <PreviewToolbar state={await getPreviewState()} /> : null}
        {children}
      </body>
    </html>
  );
}
