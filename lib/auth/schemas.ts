import { z } from "zod";
import { leagueDisplayNameSchema } from "./display-name";

const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/, "Use 3–24 letters, numbers, or underscores");
const password = z.string().min(8, "Password must be at least 8 characters").max(72);

export const loginSchema = z.object({ username, password });
export const joinSchema = z.object({
  inviteCode: z.string().min(6),
  displayName: leagueDisplayNameSchema,
  username,
  password,
});
export const createLeagueSchema = z.object({
  leagueName: z.string().trim().min(2).max(60),
  displayName: leagueDisplayNameSchema,
  username,
  password,
});
