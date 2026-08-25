import Link from "next/link";

const steps = [
  ["01", "Join your league", "Enter the reusable code from your commissioner and make your account."],
  ["02", "Pick exactly five", "Choose five teams against the pool’s frozen official spreads."],
  ["03", "Follow the pool", "Picks reveal after lock, then scores and the jackpot update in one place."],
] as const;

export default function LandingPage() {
  return (
    <main className="landing-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <Link href="/" className="wordmark" aria-label="Pick Five home">
          <span className="mark" aria-hidden="true">5</span>
          <span>PICK FIVE</span>
        </Link>
        <Link href="/login" className="button button-quiet">Log in</Link>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR NFL POOL · SIMPLIFIED</p>
          <h1>Five picks.<br /><em>One perfect week.</em></h1>
          <p className="hero-lede">
            Make your picks, watch the pool unfold, and keep the weekly jackpot transparent—without spreadsheets or group-text chaos.
          </p>
          <div className="hero-actions">
            <Link href="/join" className="button button-primary">Join with a code <span aria-hidden="true">→</span></Link>
            <Link href="/login" className="text-link">I already have an account</Link>
          </div>
          <p className="owner-link">Running the pool? <Link href="/create-league">Create a league</Link></p>
        </div>

        <div className="hero-card-wrap" aria-hidden="true">
          <div className="score-orbit orbit-one">BUF <strong>−4.5</strong></div>
          <div className="score-orbit orbit-two">DET <strong>+2.5</strong></div>
          <div className="pick-slip">
            <div className="slip-top">
              <span>WEEK 6</span>
              <span className="live-dot">OPEN</span>
            </div>
            <p className="slip-label">CURRENT JACKPOT</p>
            <p className="jackpot">$680</p>
            <div className="slip-rule" />
            <div className="slip-row"><span>Your picks</span><strong>4 / 5</strong></div>
            <div className="pick-progress"><span /></div>
            <div className="slip-row muted"><span>Locks Thursday</span><span>7:55 PM ET</span></div>
            <div className="fake-button">FINISH YOUR PICKS</div>
          </div>
        </div>
      </section>

      <section className="how-it-works" aria-labelledby="how-title">
        <p className="eyebrow">HOW IT WORKS</p>
        <h2 id="how-title">The whole pool, in your pocket.</h2>
        <div className="step-grid">
          {steps.map(([number, title, description]) => (
            <article className="step-card" key={number}>
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="site-footer">
        <span>Pick Five</span>
        <span>Private pools. Official lines. No noise.</span>
      </footer>
    </main>
  );
}
