import { describe, expect, it } from "vitest";
import { hashInviteCode, normalizeInviteCode, usernameToAuthEmail, validateUsername } from "@/lib/auth/credentials";

describe("username credentials", () => {
  it("normalizes a valid username into an internal auth email", () => {
    expect(usernameToAuthEmail(" Pat_K ")).toBe("pat_k@auth.pickfive.invalid");
  });
  it("rejects unsafe usernames", () => {
    expect(() => validateUsername("pat k")).toThrow(/3–24/);
  });
});

describe("reusable league codes", () => {
  it("normalizes human formatting before hashing", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
    expect(hashInviteCode("ABCD-EFGH")).toBe(hashInviteCode("abcdefgh"));
  });
});
