import Link from "next/link";
import type { Route } from "next";

type AuthCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
  endpoint: string;
  children: React.ReactNode;
  alternate: { text: string; label: string; href: Route };
  error?: string;
  notice?: string;
};

export function AuthCard({ eyebrow, title, description, action, endpoint, children, alternate, error, notice }: AuthCardProps) {
  return (
    <main className="auth-shell">
      <Link href="/" className="wordmark auth-wordmark">
        <span className="mark" aria-hidden="true">5</span><span>PICK FIVE</span>
      </Link>
      <section className="auth-card">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="auth-description">{description}</p>
        {error ? <p className="form-message form-error" role="alert">{error}</p> : null}
        {notice ? <p className="form-message form-notice">{notice}</p> : null}
        <form method="post" action={endpoint} className="auth-form">
          {children}
          <button className="button button-primary form-submit" type="submit">{action}</button>
        </form>
        <p className="auth-alternate">{alternate.text} <Link href={alternate.href}>{alternate.label}</Link></p>
      </section>
    </main>
  );
}

export function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const { label, hint, ...inputProps } = props;
  return (
    <label className="field">
      <span>{label}</span>
      <input {...inputProps} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
