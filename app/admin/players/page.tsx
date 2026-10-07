import { PlayersView } from "@/components/views/admin/players-view";
import { requireAdminContext } from "@/lib/auth/context";
import { loadPlayers } from "@/lib/data/admin";
import { readFlash } from "@/lib/flash";
import { isPreviewMode } from "@/lib/preview-mode";
import { getPreviewState } from "@/lib/preview/server";
import { samplePlayers } from "@/lib/preview/sample";

export default async function PlayersPage({ searchParams }: PageProps<"/admin/players">) {
  const context = await requireAdminContext();
  const flash = await readFlash(searchParams);
  if (isPreviewMode()) return <PlayersView {...samplePlayers(await getPreviewState(), flash)} />;
  return <PlayersView {...await loadPlayers(context, flash)} />;
}
