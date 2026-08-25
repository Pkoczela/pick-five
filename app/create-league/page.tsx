import { AuthCard, Field } from "@/components/auth-card";

export default async function CreateLeaguePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return (
    <AuthCard eyebrow="START A POOL" title="Create your league." description="You’ll be the owner. After setup, share your reusable league code with the players you want to invite." action="Create league" endpoint="/api/auth/create-league" error={params.error} alternate={{ text: "Joining someone else?", label: "Enter their code", href: "/join" }}>
      <Field label="League name" name="leagueName" required minLength={2} maxLength={60} placeholder="Sunday Pick Five" />
      <Field label="Your display name" name="displayName" autoComplete="name" required minLength={2} maxLength={40} />
      <Field label="Username" name="username" autoComplete="username" required minLength={3} maxLength={24} pattern="[A-Za-z0-9_]+" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} />
    </AuthCard>
  );
}
