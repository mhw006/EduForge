import { Link } from 'react-router-dom'

const transformationModes = [
  'Interactive lesson',
  'Flashcards',
  'Fill-in-the-blank',
  'Quiz mode',
  'Visual explanation',
  'Practice problems',
  'Daily focus plan',
]

const accessPillars = [
  {
    title: 'Language Differences',
    body: 'Generate leveled explanations, translated supports, and vocabulary scaffolds for multilingual learners.',
  },
  {
    title: 'Learning Differences',
    body: 'Adapt pacing and mode choice for IEP/504 needs without forcing teachers to rebuild every lesson.',
  },
  {
    title: 'Socioeconomic Gaps',
    body: 'Turn one curriculum into structured, low-friction study paths that reduce after-school resource barriers.',
  },
]

export default function Landing() {
  return (
    <main className="landing-page">
      <section className="hero-panel">
        <p className="kicker">EduForge: AI Classroom Support Layer</p>
        <h1>A single lesson can unlock a universe of learning pathways.</h1>
        <p>
          Teachers should not have to redesign curriculum for every learner. EduForge transforms one
          uploaded lesson into multiple engaging learning modes so more students can access and understand the material.
        </p>

        <div className="hero-cta-row">
          <Link className="bf-btn" to="/teacher">
            Open Teacher Dashboard
          </Link>
          <Link className="bf-btn ghost" to="/student">
            Open Student View
          </Link>
        </div>

        <article className="single-idea-strip">
          <h3>The single idea</h3>
          <p>
            One curriculum input should become many accessible outputs. Same standards, better access,
            stronger engagement, and clearer progression for every student.
          </p>
        </article>
      </section>

      <section className="bf-card flow-panel">
        <h2>Teacher Input to AI Transformation to Student Access</h2>
        <div className="flow-grid">
          <article>
            <h3>1. Teacher uploads</h3>
            <p>Slides, assignment prompts, exam topics, or lesson plans.</p>
          </article>
          <article>
            <h3>2. EduForge transforms</h3>
            <p>Creates differentiated learning artifacts from the same source content.</p>
          </article>
          <article>
            <h3>3. Students choose mode</h3>
            <p>Visual, quiz, flashcard, practice, or explain-simply pathways based on need.</p>
          </article>
        </div>
      </section>

      <section className="bf-card mode-cloud">
        <h2>Generated Learning Modes</h2>
        <div className="chip-list">
          {transformationModes.map((mode) => (
            <span key={mode}>{mode}</span>
          ))}
        </div>
      </section>

      <section className="feature-grid">
        <article className="bf-card">
          <h3>Teacher-Oriented Lesson Planning</h3>
          <p>Upload or describe a lesson and get standards-aligned micro steps for delivery.</p>
        </article>
        <article className="bf-card">
          <h3>Adaptive Learning Modes</h3>
          <p>Generate leveled practice modes for ELL, IEP, and mixed-readiness classrooms.</p>
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
