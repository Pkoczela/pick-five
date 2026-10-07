import "server-only";
import { cookies } from "next/headers";
import { PREVIEW_COOKIE, parsePreviewState } from "@/lib/preview/state";

export async function getPreviewState() {
  return parsePreviewState((await cookies()).get(PREVIEW_COOKIE)?.value);
}
