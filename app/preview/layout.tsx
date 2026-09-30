import { notFound } from "next/navigation";
import { isPreviewMode } from "@/lib/preview-mode";

export default function PreviewLayout({ children }: { children: React.ReactNode }) {
  if (!isPreviewMode()) notFound();
  return children;
}
