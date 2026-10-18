import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/live/[weekId]/route";
import { defaultPreviewState } from "@/lib/preview/state";

const mocks = vi.hoisted(() => ({ context: vi.fn(), load: vi.fn(), preview: vi.fn() }));
vi.mock("@/lib/auth/context", () => ({ requireLeagueContext: mocks.context }));
vi.mock("@/lib/data/live", () => ({ loadLive: mocks.load }));
vi.mock("@/lib/preview/server", () => ({ getPreviewState: mocks.preview }));
const weekId = "11111111-1111-4111-8111-111111111111";
const get = (id = weekId) => GET(new Request(`https://example.test/api/live/${id}`), { params: Promise.resolve({ weekId: id }) });
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("VERCEL_ENV", "production"); mocks.preview.mockResolvedValue(defaultPreviewState); });
afterEach(() => vi.unstubAllEnvs());
describe("live score GET boundary", () => {
  it("requires membership and passes its league context to the loader without shared response caching", async () => {
    const context = { leagueId: "league", memberId: "member" };
    mocks.context.mockResolvedValue(context); mocks.load.mockResolvedValue({ entries: [] });
    const response = await get();
    expect(mocks.load).toHaveBeenCalledWith(context, weekId);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
  });
  it("never reaches entries if authentication fails", async () => {
    mocks.context.mockRejectedValue(new Error("login required"));
    await expect(get()).rejects.toThrow("login required");
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("rejects invalid IDs", async () => {
    expect((await get("not-a-uuid")).status).toBe(400);
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("preview uses only sample data and never invokes production auth or loader", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.preview.mockResolvedValue({ ...defaultPreviewState, scenario: "Live" });
    expect((await (await get("sample-week-6")).json()).feed.source).toBe("Sample");
    expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.context).not.toHaveBeenCalled();
    expect((await get()).status).toBe(404);
  });
  it("preview pre-lock GET does not expose entries", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await (await get("sample-week-6")).json()).entries).toEqual([]);
  });
  it("preview supports an interrupted feed without touching real data", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    mocks.preview.mockResolvedValue({ ...defaultPreviewState, failSaves: true });
    expect((await get("sample-week-6")).status).toBe(503);
    expect(mocks.load).not.toHaveBeenCalled();
  });
});
