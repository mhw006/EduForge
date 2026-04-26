import { Link } from 'react-router-dom'

const studentModes = [
  'Read at your level',
  'Listen as audio',
  'Switch language',
  'Quick quiz',
  'Vocabulary practice',
  'Daily focus plan',
]

const accessPillars = [
  {
    title: 'Language Differences',
    body: 'Lessons translate on the fly with grade-appropriate vocabulary support, so multilingual learners stay with the class.',
  },
  {
    title: 'Learning Differences',
    body: 'Reading level, font, contrast, and audio settings adapt per student, so teachers do not have to rebuild a lesson for every IEP or 504 plan.',
  },
  {
    title: 'Bandwidth & Access Gaps',
    body: 'A text-only mode keeps lessons usable on slow or unreliable connections, so home-internet quality stops being a barrier.',
  },
]

export default function Landing() {
  return (
    <main className="landing-page">
      <section className="hero-panel">
        <p className="kicker">EduForge: One lesson, every learner</p>
        <h1>One lesson plan. Every reading level, every language, every device.</h1>
        <p>
          Teachers should not have to rewrite their curriculum for each student.
          EduForge takes one lesson and adapts it to each learner&rsquo;s reading level,
          language, and accessibility needs.
        </p>

        <div className="hero-cta-row">
          <Link className="bf-btn" to="/teacher">
            Open Teacher Dashboard
          </Link>
          <Link className="bf-btn ghost" to="/student">
            Open Student View
          </Link>
          <Link className="bf-btn ghost" to="/join">
            Join a class
          </Link>
        </div>

        <article className="single-idea-strip">
          <h3>The single idea</h3>
          <p>
            One lesson should reach every student. Same standard, more access,
            stronger engagement, and a clearer path forward for every learner.
          </p>
        </article>
      </section>

      <section className="bf-card flow-panel">
        <h2>How it works</h2>
        <div className="flow-grid">
          <article>
            <h3>1. Teacher writes once</h3>
            <p>Paste a standard or describe a lesson. EduForge writes a draft you can edit.</p>
          </article>
          <article>
            <h3>2. EduForge differentiates</h3>
            <p>Each lesson comes in three reading levels with a quiz, vocabulary, and activities.</p>
          </article>
          <article>
            <h3>3. Students get it their way</h3>
            <p>Students choose their reading level, language, font size, and audio. The lesson adapts in real time.</p>
          </article>
        </div>
      </section>

      <section className="bf-card mode-cloud">
        <h2>What students can do with one lesson</h2>
        <div className="chip-list">
          {studentModes.map((mode) => (
            <span key={mode}>{mode}</span>
          ))}
        </div>
      </section>

      <section className="feature-grid">
        <article className="bf-card">
          <h3>Lesson planning that respects your time</h3>
          <p>Generate a standards-aligned lesson, then revise it. EduForge tracks what you keep so the next draft is closer to what you want.</p>
        </article>
        <article className="bf-card">
          <h3>Built-in differentiation</h3>
          <p>Three reading levels and accessibility options come with every lesson. No add-ons, no rebuild.</p>
        </article>
      </section>

      <section className="feature-grid">
        {accessPillars.map((pillar) => (
          <article className="bf-card" key={pillar.title}>
            <h3>{pillar.title}</h3>
            <p>{pillar.body}</p>
          </article>
        ))}
      </section>
    </main>
  )
}
