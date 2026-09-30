import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { assertDatabaseAllowed, isPreviewMode } from "@/lib/preview-mode";
import { proxy } from "@/proxy";
import { createUserClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [] }) }));
const createClient = vi.hoisted(() => vi.fn(() => { throw new Error("A database client was initialized"); }));
vi.mock("@supabase/ssr", () => ({ createServerClient: createClient }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe("sample preview database isolation", () => {
  it("always isolates Vercel previews, even with production credentials present", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://production.example.invalid");
    vi.stubEnv("SUPABASE_SECRET_KEY", "must-not-be-used");
    expect(isPreviewMode()).toBe(true);
    expect(() => assertDatabaseAllowed()).toThrow("Database access is disabled");
  });
  it("does not enable sample authentication in production", () => {
    expect(isPreviewMode({ VERCEL_ENV: "production", PICK_FIVE_PREVIEW: "1" })).toBe(false);
    expect(isPreviewMode({ PICK_FIVE_PREVIEW: "1" })).toBe(true);
    expect(isPreviewMode({})).toBe(false);
  });
  it("blocks both user and service-role clients before initialization", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    await expect(createUserClient()).rejects.toThrow("Database access is disabled");
    expect(() => createAdminClient()).toThrow("Database access is disabled");
    expect(createClient).not.toHaveBeenCalled();
  });
  it.each(["/api/entries", "/api/admin/entry", "/api/admin/payment", "/api/admin/week/publish", "/api/admin/week/reopen", "/api/admin/week/finalize", "/api/admin/week/test-lock", "/api/admin/week/simulate", "/api/admin/week/simulation-reset", "/api/admin/week/manual-resolve", "/api/admin/scores/refresh", "/api/admin/schedule/import", "/api/admin/line", "/api/admin/member/update", "/api/admin/member/remove", "/api/admin/invite/rotate", "/api/auth/login", "/api/auth/join", "/api/auth/create-league", "/api/leagues/create", "/api/leagues/join"])("blocks mutation endpoint %s", async path => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const result = await proxy(new NextRequest(`https://preview.example${path}`, { method: "POST" }));
    expect(result.status).toBe(403);
    expect(createClient).not.toHaveBeenCalled();
  });
  it("blocks GET API access and page POST actions too", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    for (const [path, method] of [["/api/admin/entry", "GET"], ["/dashboard", "POST"]]) {
      expect((await proxy(new NextRequest(`https://preview.example${path}`, { method }))).status).toBe(403);
    }
  });
  it("rewrites commissioner entry reads to synthetic UI, preventing audited production reads", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const result = await proxy(new NextRequest("https://preview.example/admin/entries/person?weekId=week"));
    expect(result.headers.get("x-middleware-rewrite")).toBe("https://preview.example/preview/admin/entries/person?weekId=week");
    expect(createClient).not.toHaveBeenCalled();
  });
});
