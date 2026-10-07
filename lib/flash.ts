/** Route handlers redirect back with ?error= or ?notice=. */
export async function readFlash(searchParams: Promise<Record<string, string | string[] | undefined>>) {
  const params = await searchParams;
  return {
    error: typeof params.error === "string" ? params.error : undefined,
    notice: typeof params.notice === "string" ? params.notice : undefined,
  };
}
