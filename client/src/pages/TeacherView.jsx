import { useEffect, useMemo, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'
import DashboardCard from '../components/DashboardCard'
import TaskChecklist from '../components/TaskChecklist'
import { adaptContent, getClasses, getDashboardData, getLessonsByClass, recommendNextFocusTask, generateLessonPlan, saveGeneratedLesson } from '../services/aiClient'

// ─── Tab IDs ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard'    },
  { id: 'lessonforge', label: 'LessonForge'  },
  { id: 'adapt', label: 'Adapt Studio' },
]

// ─── Dashboard tab ────────────────────────────────────────────────────────────
const accessibilityCoverage = [
  { id: 'ac1', group: 'Multilingual learners',     coverage: '4/6 lessons adapted this week'       },
  { id: 'ac2', group: 'IEP / 504 supports',        coverage: '3/6 lessons adapted this week'       },
  { id: 'ac3', group: 'Foundational level students', coverage: '5/6 lessons adapted this week'    },
]

function summarizeStandard(standard) {
  if (!standard) return 'Standard ready for live differentiation'
  return standard.length > 110 ? `${standard.slice(0, 107)}...` : standard
}

function DashboardTab({ onNavigate }) {
  const [data,            setData]            = useState(null)
  const [recommendation,  setRecommendation]  = useState(null)
  const [curriculumQueue, setCurriculumQueue] = useState([])
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const dashboard = await getDashboardData()
        setData(dashboard)

        try {
          const rec = await recommendNextFocusTask({
            fuelPoints: dashboard.progress?.fuelPoints || 0,
            missedDays: 0,
          })
          setRecommendation(rec)
        } catch { setRecommendation(null) }

        try {
          const classesResponse = await getClasses()
          const classes = classesResponse?.classes || []
          if (classes.length === 0) return

          const lessonResults = await Promise.all(
            classes.map(async (cls) => {
              const lr = await getLessonsByClass(cls.id)
              return (lr?.lessons || []).map(l => ({
                id: l.id, title: l.title,
                source: summarizeStandard(l.standard),
                status: `${cls.name} · ${l.publishedAt ? 'Published' : 'Draft'}`,
                createdAt: l.createdAt,
                publishedAt: l.publishedAt,
              }))
            })
          )
          setCurriculumQueue(
            lessonResults.flat()
              .filter((lesson) => lesson.publishedAt)
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .slice(0, 4)
          )
        } catch { setCurriculumQueue([]) }
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const focusTasks = useMemo(() =>
    data?.todayFocusTasks?.map(t => ({ ...t, completed: t.done })) || [], [data])

  const [taskState, setTaskState] = useState([])
  useEffect(() => { setTaskState(focusTasks) }, [focusTasks])

  function toggleTask(id) {
    setTaskState(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const completed = taskState.filter(t => t.completed).length

  if (loading) return <p className="sv-muted">Loading dashboard…</p>

  return (
    <div>
      <div className="header-actions" style={{ marginBottom: '1.25rem' }}>
        <button className="bf-btn" type="button" onClick={() => onNavigate('lessonforge')}>
          + New Lesson Plan
        </button>
        <button className="bf-btn ghost" type="button" onClick={() => onNavigate('adapt')}>
          Open Adapt Studio
        </button>
      </div>

      <p style={{ marginBottom: '1.25rem', color: 'var(--muted)' }}>
        Welcome back, Teacher. Your live demo lane is ready: generate a lesson, publish it, then switch to the student view to show adaptation in real time.
      </p>

      <section className="dashboard-grid">
        <DashboardCard
          title="Today's Teacher Actions"
          action={<small>{completed}/{taskState.length} completed</small>}
        >
          <TaskChecklist tasks={taskState} onToggle={toggleTask} />
        </DashboardCard>

        <DashboardCard title="Recent Published Lessons">
          <ul className="item-list compact">
            {curriculumQueue.length > 0 ? (
              curriculumQueue.map(item => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.source}</span>
                  <small>{item.status}</small>
                </li>
              ))
            ) : (
              <li>
                <strong>No published lessons yet</strong>
                <span>Generate in LessonForge, then publish one lesson to populate this panel.</span>
                <small>Ready for your first demo-ready lesson</small>
              </li>
            )}
          </ul>
        </DashboardCard>

        <DashboardCard title="Accessibility Coverage">
          <ul className="item-list compact">
            {accessibilityCoverage.map(item => (
              <li key={item.id}>
                <strong>{item.group}</strong>
                <small>{item.coverage}</small>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard title="Class Learning Momentum">
          <BonfireWidget
            progress={{
              fuelPoints: (data?.progress?.fuelPoints || 0) + completed * 10,
              studySessions: completed,
              missedDays: 0,
            }}
          />
        </DashboardCard>
      </section>

      {recommendation && (
        <section className="bf-card recommendation-strip" style={{ marginTop: '12px' }}>
          <h3>Recommended Demo Move</h3>
          <p>{recommendation.recommendation}</p>
          <span style={{ color: 'var(--muted)', fontSize: '13px' }}>
            Suggested support mode: {recommendation.mode}
          </span>
        </section>
      )}
    </div>
  )
}

// ─── LessonForge tab ──────────────────────────────────────────────────────────
const GRADE_MAP = {
  'Grade 1-3': '2', 'Grade 4-5': '4', 'Grade 6-8': '6', 'Grade 9-12': '10', 'Lexile 900+': '12',
}

function LessonForgeTab() {
  const [form, setForm] = useState({
    title: '', dueDate: '', description: '',
    standard: '', readingLevel: 'Grade 6-8', subject: 'ELA',
  })
  const [lesson,      setLesson]      = useState(null)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [saveNotice,  setSaveNotice]  = useState(null)
  const [activeTab,   setActiveTab]   = useState('foundational')

  function updateField(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(null); setLesson(null); setSaveNotice(null)
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
        setSaveNotice({ kind: 'success', message: `Saved to PostgreSQL (lesson ID: ${saveResult.lesson.id})` })
      } catch (saveErr) {
        setSaveNotice({ kind: 'error', message: `Generated OK, but save failed: ${saveErr.message || 'Unknown error'}` })
      }
    } catch (err) {
      setError(err.message || 'Generation failed. Check your connection and try again.')
    } finally { setLoading(false) }
  }

  const tabs = [
    { key: 'foundational', label: 'Foundational', color: '#4ade80' },
    { key: 'gradeLevel',   label: 'Grade Level',  color: '#60a5fa' },
    { key: 'advanced',     label: 'Advanced',     color: '#f472b6' },
  ]

  const currentTier = lesson?.[activeTab]

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1.25rem' }}>
        Paste a standard and Claude generates a fully differentiated 3-tier lesson with activities, quiz, and vocabulary.
      </p>

      <section className="bf-card">
        <form className="form-grid" onSubmit={submit}>
          <label>
            Lesson or unit title
            <input name="title" value={form.title} onChange={updateField} placeholder="Unit 3: Fractions and Ratios" />
          </label>

          <label>
            Subject
            <select name="subject" value={form.subject} onChange={updateField}>
              <option>ELA</option><option>Math</option><option>Science</option>
              <option>Social Studies</option><option>History</option>
              <option>Art</option><option>Physical Education</option>
            </select>
          </label>

          <label>
            Curriculum standard
            <input name="standard" value={form.standard} onChange={updateField}
              placeholder="CCSS.MATH.CONTENT.5.NF.B.3 — Interpret a fraction as division…" required />
          </label>

          <label>
            Target reading level
            <select name="readingLevel" value={form.readingLevel} onChange={updateField}>
              <option>Grade 1-3</option><option>Grade 4-5</option><option>Grade 6-8</option>
              <option>Grade 9-12</option><option>Lexile 900+</option>
            </select>
          </label>

          <label className="full-width">
            Teacher notes (optional)
            <textarea name="description" value={form.description} onChange={updateField}
              placeholder="ELL supports needed, IEP accommodations, multilingual classroom…" />
          </label>

          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Claude is generating…' : 'Generate Differentiated Lesson'}
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
          <section className="bf-card" style={{ marginTop: '12px' }}>
            <div className="stack-header">
              <div>
                <h2>{lesson.title}</h2>
                <p style={{ opacity: 0.7 }}>
                  {lesson.subject} · Grade {lesson.targetGrade} · ~{lesson.estimatedMinutes} min · {lesson.standard}
                </p>
              </div>
              <div className="hero-cta-row">
                <button type="button" className="bf-btn ghost" onClick={() => window.print()}>Export PDF</button>
              </div>
            </div>

            <div className="pill-row" style={{ marginTop: '1.5rem' }}>
              {tabs.map(({ key, label, color }) => (
                <button
                  key={key} type="button"
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
            <section className="bf-card lessonforge-output" style={{ marginTop: '12px' }}>
              <h3 style={{ color: tabs.find(t => t.key === activeTab)?.color }}>
                {currentTier.levelLabel}{' '}
                <small style={{ opacity: 0.6, fontSize: '0.8em' }}>{currentTier.lexileRange}</small>
              </h3>
              <p>{currentTier.overview}</p>

              {currentTier.keyVocabulary?.length > 0 && (
                <>
                  <h4>Key vocabulary</h4>
                  <ul className="item-list compact">
                    {currentTier.keyVocabulary.map(v => (
                      <li key={v.term}><strong>{v.term}</strong><small>{v.definition}</small></li>
                    ))}
                  </ul>
                </>
              )}

              <h4>Lesson content</h4>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{currentTier.mainContent}</div>

              {currentTier.activities?.length > 0 && (
                <>
                  <h4>Activities</h4>
                  <ul className="item-list compact">
                    {currentTier.activities.map(a => (
                      <li key={a.title}>
                        <strong>{a.title} <small>({a.estimatedMinutes} min)</small></strong>
                        <span>{a.instructions}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {currentTier.quiz?.length > 0 && (
                <>
                  <h4>Quiz + answer key</h4>
                  <ol className="item-list compact">
                    {currentTier.quiz.map((q, i) => (
                      <li key={i}>
                        <strong>{q.question}</strong>
                        <ul style={{ marginTop: '0.25rem', paddingLeft: '1.25rem' }}>
                          {q.options.map(opt => (
                            <li key={opt} style={{ color: opt.startsWith(q.correctAnswer) ? '#4ade80' : 'inherit' }}>
                              {opt}
                            </li>
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
    </div>
  )
}

// ─── Adapt Studio tab ─────────────────────────────────────────────────────────
const MODE_ICONS = { visual: '👁', audio: '🔊', reading: '📖', interactive: '✋' }

function AdaptTab() {
  const [topic,      setTopic]      = useState('')
  const [profile,    setProfile]    = useState({
    readingLevel: 'Grade 6-8', language: 'English',
    dyslexiaFont: false, highContrast: false, screenReader: false, bandwidth: 'full-media',
  })
  const [adapted,    setAdapted]    = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState(null)
  const [activeMode, setActiveMode] = useState('reading')

  function updateProfile(e) {
    const { name, value, type, checked } = e.target
    setProfile(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true); setError(null); setAdapted(null)
    try {
      const result = await adaptContent(topic, profile)
      setAdapted(result)
      setActiveMode('reading')
    } catch (err) {
      setError(err.message || 'Adaptation failed. Please try again.')
    } finally { setLoading(false) }
  }

  const currentMode = adapted?.studyModes?.find(m => m.mode === activeMode)

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1.25rem' }}>
        Adapt any content to a learner profile in real time — language, reading level, accessibility — no separate version management needed.
      </p>

      <section className="bf-card">
        <h3>Learner profile</h3>
        <div className="profile-grid">
          <label>
            Reading level
            <select name="readingLevel" value={profile.readingLevel} onChange={updateProfile}>
              <option>Grade 1-3</option><option>Grade 4-5</option><option>Grade 6-8</option>
              <option>Grade 9-12</option><option>Lexile 900+</option>
            </select>
          </label>
          <label>
            Primary language
            <select name="language" value={profile.language} onChange={updateProfile}>
              <option>English</option><option>Spanish</option><option>Mandarin</option>
              <option>Tagalog</option><option>Arabic</option><option>Vietnamese</option>
              <option>Korean</option><option>French</option><option>Portuguese</option>
              <option>Hindi</option><option>Somali</option><option>Hmong</option>
            </select>
          </label>
          <label>
            Bandwidth mode
            <select name="bandwidth" value={profile.bandwidth} onChange={updateProfile}>
              <option value="full-media">Full media</option>
              <option value="reduced-media">Reduced media</option>
              <option value="text-only">Text-only offline</option>
            </select>
          </label>
        </div>
        <div className="toggle-row">
          <label><input type="checkbox" name="dyslexiaFont" checked={profile.dyslexiaFont} onChange={updateProfile} /> Dyslexia-friendly formatting</label>
          <label><input type="checkbox" name="highContrast" checked={profile.highContrast} onChange={updateProfile} /> High contrast</label>
          <label><input type="checkbox" name="screenReader" checked={profile.screenReader} onChange={updateProfile} /> Screen reader mode</label>
        </div>
      </section>

      <section className="bf-card" style={{ marginTop: '12px' }}>
        <form className="inline-form" onSubmit={submit}>
          <input
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="Enter a lesson topic, standard, or paste content to adapt"
            required
          />
          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Claude is adapting…' : 'Adapt Content'}
          </button>
        </form>
        {error && <p style={{ color: '#f87171', marginTop: '0.75rem' }}>{error}</p>}
      </section>

      {adapted && (
        <div
          className={`eduadapt-preview ${profile.highContrast ? 'high-contrast' : ''} ${profile.dyslexiaFont ? 'dyslexia-font' : ''}`}
          aria-live={profile.screenReader ? 'polite' : 'off'}
          style={{ marginTop: '12px' }}
        >
          <article className="bf-card" style={{ padding: '0.75rem 1.25rem' }}>
            <p style={{ opacity: 0.8, margin: 0, fontSize: '0.875rem' }}>
              Adapted for: <strong>{adapted.accessibilityMeta?.language}</strong> ·{' '}
              <strong>{adapted.accessibilityMeta?.appliedReadingLevel}</strong> ·{' '}
              Bandwidth: <strong>{adapted.accessibilityMeta?.bandwidthMode}</strong>
              {adapted.accessibilityMeta?.dyslexiaFont ? ' · Dyslexia font' : ''}
              {adapted.accessibilityMeta?.screenReader ? ' · Screen reader' : ''}
            </p>
          </article>

          <article className="bf-card" style={{ marginTop: '12px' }}>
            <h2>{adapted.adaptedTitle}</h2>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: profile.dyslexiaFont ? 2 : 1.7 }}>
              {adapted.mainContent}
            </div>
          </article>

          {adapted.keyTerms?.length > 0 && (
            <article className="bf-card" style={{ marginTop: '12px' }}>
              <h3>Key terms</h3>
              <ul className="item-list compact">
                {adapted.keyTerms.map(t => (
                  <li key={t.term}><strong>{t.term}</strong><small>{t.definition}</small></li>
                ))}
              </ul>
            </article>
          )}

          {adapted.studyModes?.length > 0 && (
            <article className="bf-card" style={{ marginTop: '12px' }}>
              <h3>Study modes</h3>
              <div className="pill-row">
                {adapted.studyModes.map(m => (
                  <button key={m.mode} type="button"
                    className={activeMode === m.mode ? 'pill active' : 'pill'}
                    onClick={() => setActiveMode(m.mode)}
                  >
                    {MODE_ICONS[m.mode]} {m.label}
                  </button>
                ))}
              </div>
              {currentMode && (
                <div className="mode-content" style={{ marginTop: '1rem' }}>
                  <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{currentMode.description}</p>
                  {currentMode.accessibilityNote && (
                    <small style={{ opacity: 0.6, display: 'block', marginTop: '0.5rem' }}>
                      Accessibility: {currentMode.accessibilityNote}
                    </small>
                  )}
                </div>
              )}
            </article>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main TeacherView shell ───────────────────────────────────────────────────
export default function TeacherView() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const current = TABS.find(t => t.id === activeTab)

  function renderTab() {
    switch (activeTab) {
      case 'dashboard':   return <DashboardTab onNavigate={setActiveTab} />
      case 'lessonforge': return <LessonForgeTab />
      case 'adapt':       return <AdaptTab />
      default:            return null
    }
  }

  return (
    <div className="sv-shell">
      <nav className="sv-sidebar">
        <p className="sv-sidebar-label">Teacher View</p>
        {TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            className={`sv-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="sv-tab-icon">{tab.icon}</span>
            <span className="sv-tab-label">{tab.label}</span>
          </button>
        ))}
      </nav>

      <main className="sv-content">
        <header className="sv-content-header">
          <h1>{current?.icon} {current?.label}</h1>
        </header>
        {renderTab()}
      </main>
    </div>
  )
}
