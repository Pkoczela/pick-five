"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="setup-state">
      <p className="eyebrow">Something went wrong</p>
      <h1>The pool hit a snag.</h1>
      <p>Your saved picks and league data haven’t changed. Try loading the page again.</p>
      <button type="button" className="button button-primary" onClick={reset}>Try again</button>
    </main>
  );
}
