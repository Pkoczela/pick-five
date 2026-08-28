import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createInviteCode, hashInviteCode, usernameToAuthEmail } from "./credentials";

type AccountInput = { username: string; displayName: string; password: string };

export async function createLeagueOwnerAccount(input: AccountInput & { leagueName: string }) {
  const admin = createAdminClient();
  const email = usernameToAuthEmail(input.username);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { username: input.username, display_name: input.displayName },
  });
  if (authError || !authData.user) throw new Error(readableAuthError(authError?.message));

  const inviteCode = createInviteCode();
  const slug = `${slugify(input.leagueName)}-${Math.random().toString(36).slice(2, 7)}`;
  const { data: leagueId, error } = await admin.rpc("create_owned_league", {
    p_user_id: authData.user.id,
    p_name: input.leagueName,
    p_slug: slug,
    p_invite_code_hash: hashInviteCode(inviteCode),
    p_invite_code_hint: inviteCode.slice(-4),
  });
  if (error) {
    await admin.auth.admin.deleteUser(authData.user.id);
    throw new Error("Could not create the league. Please try again.");
  }
  return { email, inviteCode, leagueId: String(leagueId) };
}

export async function createPlayerAccount(input: AccountInput & { inviteCode: string }) {
  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("league_invites")
    .select("id, league_id")
    .eq("code_hash", hashInviteCode(input.inviteCode))
    .eq("active", true)
    .maybeSingle();
  if (inviteError || !invite) throw new Error("That league code is invalid or has been disabled.");

  const email = usernameToAuthEmail(input.username);
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { username: input.username, display_name: input.displayName },
  });
  if (authError || !authData.user) throw new Error(readableAuthError(authError?.message));

  const { error } = await admin.from("league_members").insert({
    league_id: invite.league_id,
    user_id: authData.user.id,
    display_name: input.displayName,
    role: "PLAYER",
    joined_at: new Date().toISOString(),
  });
  if (error) {
    await admin.auth.admin.deleteUser(authData.user.id);
    throw new Error("Could not join the league. Please ask the owner to check the code.");
  }
  return { email, leagueId: invite.league_id };
}

function readableAuthError(message?: string) {
  return message?.toLowerCase().includes("already") ? "That username is already taken." : "Could not create the account. Please try a different username.";
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "league";
}
