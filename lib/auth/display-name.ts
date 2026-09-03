import { z } from "zod";

export const leagueDisplayNameSchema = z.string().trim().min(2, "Display name must be at least 2 characters").max(40, "Display name must be 40 characters or fewer");

export function friendlyDisplayNameError(message: string) {
  if (message.includes("already in use") || message.includes("league_members_display_name_unique") || message.includes("duplicate key")) {
    return "That display name is already in use in this league. Try adding your last initial or last name.";
  }
  return message;
}
