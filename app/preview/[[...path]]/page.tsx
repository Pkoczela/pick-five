import { notFound } from "next/navigation";
import { isPreviewMode } from "@/lib/preview-mode";

export const dynamic = "force-dynamic";
export const metadata = { title: "Design preview", robots: { index: false, follow: false } };
export default function PreviewPage() {
  if (!isPreviewMode()) notFound();
  return null;
}
