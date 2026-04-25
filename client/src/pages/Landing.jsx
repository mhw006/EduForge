import { Link } from 'react-router-dom'

export default function Landing() {
  return (
    <main className="landing-page">
      <section className="hero-panel">
        <p className="kicker">Bonfire: AI-Powered Student Focus</p>
        <h1>Turn overwhelm into a clear daily plan.</h1>
        <p>
          Bonfire helps college students break assignments and exams into manageable focus tasks,
          then study each topic with interactive modes.
        </p>

        <div className="hero-cta-row">
          <Link className="bf-btn" to="/dashboard">
            Enter Dashboard
          </Link>
          <Link className="bf-btn ghost" to="/assignment">
            Generate Focus Plan
          </Link>
        </div>
      </section>

      <section className="feature-grid">
        <article className="bf-card">
          <h3>Assignment Breakdown</h3>
          <p>Convert one assignment into 3-5 clear micro-tasks with recommended days.</p>
        </article>
        <article className="bf-card">
          <h3>Exam Focus Maps</h3>
          <p>Build a smart schedule by topic confidence and priority.</p>
        </article>
        <article className="bf-card">
          <h3>Study Modes</h3>
          <p>Switch between flashcards, quiz mode, fill-in-the-blank, and practice drills.</p>
        </article>
      </section>
    </main>
  )
}
