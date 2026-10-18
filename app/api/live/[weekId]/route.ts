import { z } from "zod";
import { requireLeagueContext } from "@/lib/auth/context";
import { loadLive } from "@/lib/data/live";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { sampleLiveSnapshot } from "@/lib/preview/sample";

const headers = { "Cache-Control": "private, no-store", Vary: "Cookie" };
/** Display-only: authenticated reads, never score ingestion or grading. */
export async function GET(_request: Request, { params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  if (isPreviewMode()) {
    if (!/^sample-week-[1-6]$/.test(weekId)) return Response.json({ error: "Sample week only." }, { status: 404, headers });
    const state = await getPreviewState();
    if (state.failSaves) return Response.json({ error: "Sample score interruption." }, { status: 503, headers });
    return Response.json(sampleLiveSnapshot(state, weekId), { headers });
  }
  if (!z.uuid().safeParse(weekId).success) return Response.json({ error: "Invalid week." }, { status: 400, headers });
  const context = await requireLeagueContext();
  return Response.json(await loadLive(context, weekId), { headers });
}
