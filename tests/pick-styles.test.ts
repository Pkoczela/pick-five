import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const base = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const redesign = readFileSync(new URL("../app/redesign.css", import.meta.url), "utf8");

// Stylesheet contract checks; browser checks separately verify the rendered color.
describe("pick selection styling", () => {
  it("limits team hover feedback to fine pointers that support hover", () => {
    expect(base).toMatch(/@media\s*\(hover: hover\)\s*and\s*\(pointer: fine\)\s*\{\s*\.team-option:not\(\.selected\):hover:not\(:disabled\)\s*\{/);
  });

  it("never applies a team hover rule to a selected team", () => {
    const selectors = [...`${base}\n${redesign}`.matchAll(/([^{}]+)\{/g)]
      .map(match => match[1].trim())
      .filter(selector => selector.includes(".team-option") && selector.includes(":hover"));
    expect(selectors.length).toBeGreaterThan(0);
    for (const selector of selectors) expect(selector).toContain(":not(.selected)");
  });

  it("retains explicit selected backgrounds in both themes", () => {
    expect(base).toMatch(/\.team-option\.selected\s*\{[^}]*background:\s*var\(--lime\)/);
    expect(redesign).toMatch(/\.team-option\.selected\s*\{[^}]*background:\s*#e5efbb/);
  });
});
