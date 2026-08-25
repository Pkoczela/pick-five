import { createHash, randomBytes } from "node:crypto";

const USERNAME_PATTERN = /^[a-z0-9_]{3,24}$/;

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function validateUsername(value: string) {
  const normalized = normalizeUsername(value);
  if (!USERNAME_PATTERN.test(normalized)) throw new Error("Username must be 3–24 characters using letters, numbers, or underscores");
  return normalized;
}

export function usernameToAuthEmail(username: string) {
  return `${validateUsername(username)}@auth.pickfive.invalid`;
}

export function normalizeInviteCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashInviteCode(value: string) {
  const normalized = normalizeInviteCode(value);
  if (normalized.length < 6) throw new Error("Invitation code is invalid");
  return createHash("sha256").update(normalized).digest("hex");
}

export function createInviteCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  const body = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
  return `${body.slice(0, 4)}-${body.slice(4)}`;
}
