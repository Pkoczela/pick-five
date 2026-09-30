/** Preview deployments are always isolated from league databases. */
export function isPreviewMode(env: Record<string, string | undefined> = process.env) {
  return env.VERCEL_ENV === "preview" || (env.VERCEL_ENV !== "production" && env.PICK_FIVE_PREVIEW === "1");
}

export function assertDatabaseAllowed() {
  if (isPreviewMode()) throw new Error("Database access is disabled in the Pick Five sample preview.");
}
