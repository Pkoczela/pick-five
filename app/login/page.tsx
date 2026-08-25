import { AuthCard, Field } from "@/components/auth-card";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  return (
    <AuthCard eyebrow="WELCOME BACK" title="Log in" description="Use the username and password you chose when you joined your league." action="Log in" endpoint="/api/auth/login" error={params.error} notice={params.notice} alternate={{ text: "Have a league code?", label: "Join a league", href: "/join" }}>
      <Field label="Username" name="username" autoComplete="username" required minLength={3} maxLength={24} />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required minLength={8} />
    </AuthCard>
  );
}
