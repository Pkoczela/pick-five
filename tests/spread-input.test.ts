import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WeeksView } from "@/components/views/admin/weeks-view";

const markup = renderToStaticMarkup(createElement(WeeksView, {
  leagueName: "Test", seasonYear: 2026,
  week: { id: "week", number: 1, seasonType: 2, status: "DRAFT", lockAt: null, testLockActive: false },
  games: [{ id: "game", kickoffAt: "2026-10-18T17:00:00Z", away: "BUF", home: "MIA", homeSpread: -3.5 }],
}));
const input = markup.match(/<input[^>]*name="homeSpread"[^>]*>/)![0];
const pattern = new RegExp(`^(?:${input.match(/pattern="([^"]+)"/)![1]})$`, "v");

describe("mobile spread input", () => {
  it("uses a text keyboard so a minus sign is available", () => {
    expect(input).toContain('type="text"');
    expect(input).toContain('inputMode="text"');
    expect(input).toContain('value="-3.5"');
    expect(input).toContain('required=""');
  });
  it.each(["-3.5", "+3.5", "3", "0", "-0.5", ".5", "3.50"])("accepts signed whole/half points: %s", value => {
    expect(pattern.test(value)).toBe(true);
  });
  it.each(["", "-", "3.25", "abc", "--3", "3,5"])("rejects invalid spread: %s", value => {
    expect(pattern.test(value)).toBe(false);
  });
});
