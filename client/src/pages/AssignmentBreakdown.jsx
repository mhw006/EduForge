import { useState } from 'react'
import { generateLessonPlan, saveGeneratedLesson } from '../services/aiClient'

const GRADE_MAP = {
  'Grade 1-3': '2',
  'Grade 4-5': '4',
  'Grade 6-8': '6',
  'Grade 9-12': '10',
  'Lexile 900+': '12',
}

export default function AssignmentBreakdown() {
  const [form, setForm] = useState({
    title: '',
    dueDate: '',
    description: '',
    standard: '',
    readingLevel: 'Grade 6-8',
    subject: 'ELA',
  })
  const [lesson, setLesson] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [saveNotice, setSaveNotice] = useState(null)
  const [activeTab, setActiveTab] = useState('foundational')

  function updateField(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setLesson(null)
    setSaveNotice(null)
    try {
      const result = await generateLessonPlan({
        standard: form.standard,
        gradeLevel: GRADE_MAP[form.readingLevel] || '6',
        subject: form.subject,
        description: form.description,
      })
      setLesson(result)
      setActiveTab('foundational')

      try {
        const saveResult = await saveGeneratedLesson({
          className: 'LessonForge Drafts',
          title: form.title,
          standard: form.standard,
          lesson: result,
        })
        setSaveNotice({
          kind: 'success',
          message: `Saved to PostgreSQL (lesson ID: ${saveResult.lesson.id})`,
        })
      } catch (saveErr) {
        setSaveNotice({
          kind: 'error',
          message: `Generated successfully, but save failed: ${saveErr.message || 'Unknown error'}`,
        })
      }
    } catch (err) {
      setError(err.message || 'Generation failed. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const tabs = [
    { key: 'foundational', label: 'Foundational', color: '#4ade80' },
    { key: 'gradeLevel',   label: 'Grade Level',  color: '#60a5fa' },
    { key: 'advanced',     label: 'Advanced',     color: '#f472b6' },
  ]

  const currentTier = lesson?.[activeTab]

  return (
    <main className="page-wrap narrow">
      <header className="page-header single">
        <h1>LessonForge Engine</h1>
        <p>Paste a standard and transform one lesson into differentiated plans, quiz assets, and extension activities.</p>
      </header>

      <section className="bf-card">
        <form className="form-grid" onSubmit={submit}>
          <label>
            Lesson or unit title
            <input name="title" value={form.title} onChange={updateField} placeholder="Unit 3: Fractions and Ratios" />
          </label>

          <label>
            Subject
            <select name="subject" value={form.subject} onChange={updateField}>
              <option>ELA</option>
              <option>Math</option>
              <option>Science</option>
              <option>Social Studies</option>
              <option>History</option>
              <option>Art</option>
              <option>Physical Education</option>
            </select>
          </label>

          <label>
            Curriculum standard
            <input name="standard" value={form.standard} onChange={updateField} placeholder="CCSS.MATH.CONTENT.5.NF.B.3 — Interpret a fraction as division…" required />
          </label>

          <label>
            Target reading level
            <select name="readingLevel" value={form.readingLevel} onChange={updateField}>
              <option>Grade 1-3</option>
              <option>Grade 4-5</option>
              <option>Grade 6-8</option>
              <option>Grade 9-12</option>
              <option>Lexile 900+</option>
            </select>
          </label>

          <label className="full-width">
            Teacher notes (optional)
            <textarea name="description" value={form.description} onChange={updateField} placeholder="ELL supports needed, IEP accommodations for word problems, multilingual classroom…" />
          </label>

          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Generating lesson…' : 'Generate Differentiated Lesson'}
          </button>
        </form>
        {error && <p style={{ color: '#f87171', marginTop: '1rem' }}>{error}</p>}
        {saveNotice && (
          <p style={{ color: saveNotice.kind === 'success' ? '#4ade80' : '#facc15', marginTop: '0.75rem' }}>
            {saveNotice.message}
          </p>
        )}
      </section>

      {lesson && (
        <>
          <section className="bf-card">
            <div className="stack-header">
              <div>
                <h2>{lesson.title}</h2>
                <p style={{ opacity: 0.7 }}>
                  {lesson.subject} · Grade {lesson.targetGrade} · ~{lesson.estimatedMinutes} min · {lesson.standard}
                </p>
              </div>
              <div className="hero-cta-row">
                <button type="button" className="bf-btn ghost" onClick={() => window.print()}>Export PDF</button>
                <button type="button" className="bf-btn ghost">Send to Classroom</button>
              </div>
            </div>

            {/* Tier tabs */}
            <div className="pill-row" style={{ marginTop: '1.5rem' }}>
              {tabs.map(({ key, label, color }) => (
                <button
                  key={key}
                  type="button"
                  className={activeTab === key ? 'pill active' : 'pill'}
                  style={activeTab === key ? { borderColor: color, color } : {}}
                  onClick={() => setActiveTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {currentTier && (
            <section className="bf-card lessonforge-output">
              <h3 style={{ color: tabs.find(t => t.key === activeTab)?.color }}>
                {currentTier.levelLabel} <small style={{ opacity: 0.6, fontSize: '0.8em' }}>{currentTier.lexileRange}</small>
              </h3>
              <p>{currentTier.overview}</p>

              {/* Key vocabulary */}
              {currentTier.keyVocabulary?.length > 0 && (
                <>
                  <h4>Key vocabulary</h4>
                  <ul className="item-list compact">
                    {currentTier.keyVocabulary.map((v) => (
                      <li key={v.term}>
                        <strong>{v.term}</strong>
                        <small>{v.definition}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Main content */}
              <h4>Lesson content</h4>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{currentTier.mainContent}</div>

              {/* Activities */}
              {currentTier.activities?.length > 0 && (
                <>
                  <h4>Activities</h4>
                  <ul className="item-list compact">
                    {currentTier.activities.map((a) => (
                      <li key={a.title}>
                        <strong>{a.title} <small>({a.estimatedMinutes} min)</small></strong>
                        <span>{a.instructions}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* Quiz */}
              {currentTier.quiz?.length > 0 && (
                <>
                  <h4>Quiz + answer key</h4>
                  <ol className="item-list compact">
                    {currentTier.quiz.map((q, i) => (
                      <li key={i}>
                        <strong>{q.question}</strong>
                        <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                          {q.options.map((opt) => (
                            <li key={opt} style={{ color: opt.startsWith(q.correctAnswer) ? '#4ade80' : 'inherit' }}>{opt}</li>
                          ))}
                        </ul>
                        <small>Answer: {q.correctAnswer} — {q.explanation}</small>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </section>
          )}
        </>
      )}
    </main>
  )
}
