import { AuthCard, Field } from "@/components/auth-card";

export default async function JoinPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return (
    <AuthCard eyebrow="JOIN A LEAGUE" title="You’re invited." description="Enter the reusable code from your league owner, then make the account you’ll use each week." action="Create account" endpoint="/api/auth/join" error={params.error} alternate={{ text: "Already joined?", label: "Log in", href: "/login" }}>
      <Field label="League code" name="inviteCode" autoCapitalize="characters" autoComplete="off" required minLength={6} placeholder="ABCD-EFGH" />
      <Field label="Display name" name="displayName" autoComplete="name" required minLength={2} maxLength={40} hint="Shown to the other people in your pool." />
      <Field label="Username" name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" hint="3–24 letters, numbers, or underscores." />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="Use at least 8 characters." />
    </AuthCard>
  );
}
