import { useEffect, useMemo, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'
import DashboardCard from '../components/DashboardCard'
import TaskChecklist from '../components/TaskChecklist'
import { adaptContent, getClassAnalytics, getClasses, getDashboardData, getLessonsByClass, recommendNextFocusTask, generateLessonPlan, saveGeneratedLesson, logLessonEdit, getEditSummary, searchStandards } from '../services/aiClient'

// ─── Tab IDs ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',   icon: '📊', label: 'Dashboard'    },
  { id: 'lessonforge', icon: '🧠', label: 'LessonForge'  },
  { id: 'adapt',       icon: '🎯', label: 'Adapt Studio' },
]

function summarizeStandard(standard) {
  if (!standard) return 'Standard ready for live differentiation'
  return standard.length > 110 ? `${standard.slice(0, 107)}...` : standard
}

function prettyLabel(value) {
  if (!value) return 'None yet'
  return value.replaceAll('_', ' ').toLowerCase()
}

function prettyEventLabel(value) {
  if (!value) return 'No dominant pattern yet'
  return {
    VIEW: 'Lesson views',
    QUIZ_START: 'Quiz starts',
    QUIZ_COMPLETE: 'Quiz completions',
    LANGUAGE_TOGGLE: 'Language switching',
    TTS_TOGGLE: 'Audio support usage',
    BANDWIDTH_CHANGE: 'Bandwidth changes',
    EXPORT_PDF: 'PDF exports',
  }[value] || prettyLabel(value)
}

function ClosedLoopOverviewCard({ analytics }) {
  const metrics = analytics?.loopMetrics
  if (!metrics) return <p className="sv-muted">Generate activity in class to unlock intelligence signals.</p>

  const items = [
    { label: 'Published lessons', value: metrics.publishedLessons },
    { label: 'Diagnostics completed', value: metrics.diagnosticsCompleted },
    { label: 'AI edits logged', value: metrics.aiEditsLogged },
    { label: 'Quiz attempts', value: metrics.quizAttempts },
    { label: 'Engagement events', value: metrics.engagementEvents },
    { label: 'Students tracked', value: metrics.studentsTracked },
  ]

  return (
    <div className="teacher-metric-grid">
      {items.map((item) => (
        <div key={item.label} className="teacher-metric-tile">
          <small className="sv-muted">{item.label}</small>
          <strong>{item.value ?? 0}</strong>
        </div>
      ))}
    </div>
  )
}

function ClassInsightsCard({ analytics }) {
  if (!analytics?.insights) return <p className="sv-muted">Insights will appear once students interact with lessons.</p>

  const { insights, readingLevelDistribution, lessonEngagement } = analytics
  const readingMix = readingLevelDistribution?.length
    ? readingLevelDistribution.map((row) => `${prettyLabel(row.level)} (${row.count})`).join(' · ')
    : 'No learner profiles yet'

  return (
    <ul className="item-list compact">
      <li>
        <strong>Most viewed lesson</strong>
        <span>{insights.mostViewedLesson?.title || 'No lesson views yet'}</span>
        <small>{insights.mostViewedLesson ? `${insights.mostViewedLesson.views} views` : 'Waiting on student traffic'}</small>
      </li>
      <li>
        <strong>Lowest performing level</strong>
        <span>{prettyLabel(insights.lowestPerformingLevel)}</span>
        <small>{insights.avgQuizScoreOverall != null ? `Average quiz score: ${insights.avgQuizScoreOverall}%` : 'Publish a quiz-backed lesson to unlock performance insight'}</small>
      </li>
      <li>
        <strong>Teacher rewrite hotspot</strong>
        <span>{prettyLabel(insights.mostEditedSection)}</span>
        <small>{analytics.editSectionSummary?.length ? 'AI vs final deltas are being tracked live' : 'No teacher feedback logged yet — accept or edit one generated section to start the loop'}</small>
      </li>
      <li>
        <strong>Reading-level mix</strong>
        <span>{readingMix}</span>
        <small>{lessonEngagement?.length ? `${lessonEngagement.length} ready lessons in this class` : 'No ready lessons yet'}</small>
      </li>
    </ul>
  )
}

function StudentSignalsCard({ analytics }) {
  if (!analytics?.loopMetrics) {
    return <p className="sv-muted">Student signals will appear after diagnostics, lesson opens, and quiz attempts.</p>
  }

  const topEvent = analytics.insights?.topEventType
  const mathMix = analytics.mathLevelDistribution?.length
    ? analytics.mathLevelDistribution.map((row) => `${prettyLabel(row.level)} (${row.count})`).join(' · ')
    : 'No math profile data yet'

  return (
    <ul className="item-list compact">
      <li>
        <strong>Support watchlist</strong>
        <span>{analytics.insights?.studentsNeedingSupport || 0} {analytics.insights?.studentsNeedingSupport === 1 ? 'student is' : 'students are'} currently flagged for foundational support</span>
        <small>{analytics.loopMetrics.diagnosticsCompleted > 0 ? `${analytics.loopMetrics.diagnosticsCompleted} diagnostics completed` : 'Run a diagnostic to sharpen this signal'}</small>
      </li>
      <li>
        <strong>Top student behavior</strong>
        <span>{prettyEventLabel(topEvent)}</span>
        <small>{analytics.loopMetrics.engagementEvents} engagement events captured across the class</small>
      </li>
      <li>
        <strong>Math-level mix</strong>
        <span>{mathMix}</span>
        <small>{analytics.loopMetrics.studentsTracked} student profiles represented in this view</small>
      </li>
    </ul>
  )
}

function RecommendedActionsCard({ analytics, recommendation }) {
  const suggestions = [
    ...(analytics?.recommendations || []),
    recommendation?.recommendation || null,
  ].filter(Boolean).slice(0, 4)

  if (suggestions.length === 0) {
    return <p className="sv-muted">Recommendations will appear after diagnostics, edits, and engagement data come in.</p>
  }

  return (
    <ul className="item-list compact">
      {suggestions.map((item, index) => (
        <li key={`${index}-${item.slice(0, 20)}`}>
          <strong>{index === 0 ? 'Highest priority' : `Next move ${index + 1}`}</strong>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

// ─── Phase 1+3: Data Flywheel widget — AI vs Final teacher edits ─────────────
function EditFlywheelWidget({ summary, loading }) {
  if (loading) return <p className="sv-muted">Loading edit metrics…</p>
  if (!summary || summary.totalEdits === 0) {
    return (
      <p className="sv-muted">
        No edit telemetry yet. Open LessonForge, generate a lesson, and click <strong>Accept</strong>
        on any section to start populating the flywheel.
      </p>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
        <div>
          <small className="sv-muted">Total edits</small>
          <h3 style={{ margin: 0 }}>{summary.totalEdits}</h3>
        </div>
        <div>
          <small className="sv-muted">Acceptance rate</small>
          <h3 style={{ margin: 0, color: summary.acceptanceRate > 0.7 ? '#4ade80' : '#facc15' }}>
            {Math.round(summary.acceptanceRate * 100)}%
          </h3>
        </div>
        <div>
          <small className="sv-muted">Avg edit size</small>
          <h3 style={{ margin: 0 }}>{summary.avgCharDelta} chars</h3>
        </div>
      </div>
      {summary.bySection.length > 0 && (
        <ul className="item-list compact" style={{ marginTop: '0.5rem' }}>
          {summary.bySection.slice(0, 5).map((s) => (
            <li key={s.section}>
              <strong>{s.section.replace('_', ' ').toLowerCase()}</strong>
              <small>
                {s.accepted_as_is || 0} accepted · {s.modified || 0} edited · {s.regenerated || 0} regenerated
              </small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DashboardTab({ onNavigate }) {
  const [data,            setData]            = useState(null)
  const [recommendation,  setRecommendation]  = useState(null)
  const [curriculumQueue, setCurriculumQueue] = useState([])
  const [classes,         setClasses]         = useState([])
  const [primaryClassId,  setPrimaryClassId]  = useState(null)
  const [classAnalytics,  setClassAnalytics]  = useState(null)
  const [editSummary,     setEditSummary]     = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
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
          const nextClasses = classesResponse?.classes || []
          setClasses(nextClasses)
          if (nextClasses.length === 0) return
          const defaultClassId = nextClasses[0].id
          setPrimaryClassId(defaultClassId)

          const lessonResults = await Promise.all(
            nextClasses.map(async (cls) => {
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
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .slice(0, 4)
          )
        } catch { setCurriculumQueue([]) }
      } finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (!primaryClassId) return

    let cancelled = false
    async function loadClassIntelligence() {
      setAnalyticsLoading(true)
      try {
        const [analyticsResult, editResult] = await Promise.all([
          getClassAnalytics(primaryClassId),
          getEditSummary({ classId: primaryClassId }),
        ])
        if (!cancelled) {
          setClassAnalytics(analyticsResult)
          setEditSummary(editResult)
        }
      } catch {
        if (!cancelled) {
          setClassAnalytics(null)
          setEditSummary(null)
        }
      } finally {
        if (!cancelled) setAnalyticsLoading(false)
      }
    }

    loadClassIntelligence()
    return () => { cancelled = true }
  }, [primaryClassId])

  const focusTasks = useMemo(() =>
    data?.todayFocusTasks?.map(t => ({ ...t, completed: t.done })) || [], [data])

  const [taskState, setTaskState] = useState([])
  useEffect(() => { setTaskState(focusTasks) }, [focusTasks])

  function toggleTask(id) {
    setTaskState(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
  }

  const completed = taskState.filter(t => t.completed).length
  const activeClassName = classes.find((cls) => cls.id === primaryClassId)?.name

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
        Welcome back, Teacher. This dashboard turns classroom signals into next steps: what students need, what the AI got changed, and where to intervene next.
      </p>

      {classes.length > 0 && (
        <div style={{ marginBottom: '1rem', maxWidth: '280px' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span className="sv-muted">Class intelligence view</span>
            <select value={primaryClassId || ''} onChange={(e) => setPrimaryClassId(e.target.value)}>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <section className="bf-card recommendation-strip" style={{ marginBottom: '12px' }}>
        <h3>Closed-Loop Classroom Intelligence</h3>
        <p>
          {activeClassName
            ? `EduForge is tracking how ${activeClassName} students respond to lessons, how teachers revise AI output, and what support to recommend next.`
            : 'EduForge will surface classroom intelligence once a class is selected.'}
        </p>
        <span>Signals flow from diagnostics, adaptation, engagement, quizzes, and teacher feedback into one instructional loop.</span>
      </section>

      <section className="dashboard-grid">
        <DashboardCard title="Closed-Loop Overview">
          <ClosedLoopOverviewCard analytics={classAnalytics} />
        </DashboardCard>

        <DashboardCard title="Recommended Next Actions">
          <RecommendedActionsCard analytics={classAnalytics} recommendation={recommendation} />
        </DashboardCard>

        <DashboardCard title="Class Insights">
          <ClassInsightsCard analytics={classAnalytics} />
        </DashboardCard>

        <DashboardCard title="Student Learning Signals">
          <StudentSignalsCard analytics={classAnalytics} />
        </DashboardCard>

        <DashboardCard
          title="Today's Teacher Actions"
          action={<small>{completed}/{taskState.length} completed</small>}
        >
          <TaskChecklist tasks={taskState} onToggle={toggleTask} />
        </DashboardCard>

        <DashboardCard title="Recent Saved Lessons">
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
                <strong>No saved lessons yet</strong>
                <span>Generate in LessonForge to create a stored draft, then publish when you're ready.</span>
                <small>Drafts and published lessons will both appear here</small>
              </li>
            )}
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

        <DashboardCard title="AI vs Final Edits (Data Flywheel)">
          <EditFlywheelWidget summary={editSummary} loading={analyticsLoading} />
        </DashboardCard>
      </section>
    </div>
  )
}

// ─── LessonForge tab ──────────────────────────────────────────────────────────
const GRADE_MAP = {
  'Grade 1-3': '2', 'Grade 4-5': '4', 'Grade 6-8': '6', 'Grade 9-12': '10', 'Lexile 900+': '12',
}

// ─── Phase 1: Per-section AcceptButton (telemetry capture) ───────────────────
const SECTION_LEVEL_KEY = (level, section) => `${level}::${section}`

function AcceptButton({ lessonId, level, section, aiVersion, accepted, onAccept }) {
  if (!lessonId) return null
  const key = SECTION_LEVEL_KEY(level, section)
  const isAccepted = !!accepted[key]
  return (
    <button
      type="button"
      className={isAccepted ? 'pill active' : 'pill'}
      style={{ marginLeft: '0.5rem', fontSize: '0.75em', padding: '4px 10px' }}
      disabled={isAccepted}
      onClick={async () => {
        const result = await logLessonEdit({
          lessonId,
          level: levelKeyToEnum(level),
          section,
          editType: 'ACCEPTED_AS_IS',
          aiVersion,
          humanVersion: aiVersion,
        })
        if (result) onAccept(key)
      }}
      title="Mark this section as accepted as-is (logs telemetry for the data flywheel)"
    >
      {isAccepted ? '✓ Accepted' : 'Accept'}
    </button>
  )
}

// LessonForge UI uses lowercase level keys (foundational/gradeLevel/advanced).
// LessonEdit schema uses enum strings (FOUNDATIONAL/GRADE_LEVEL/ADVANCED).
function levelKeyToEnum(key) {
  return { foundational: 'FOUNDATIONAL', gradeLevel: 'GRADE_LEVEL', advanced: 'ADVANCED' }[key] || 'GRADE_LEVEL'
}

// ─── Phase 2: Curriculum standards autocomplete ──────────────────────────────
function StandardAutocomplete({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!value || value.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await searchStandards(value, 6)
        setSuggestions(r.standards || [])
      } catch { setSuggestions([]) }
    }, 250) // debounce — don't hammer the API while user types
    return () => clearTimeout(t)
  }, [value])

  return (
    <div style={{ position: 'relative' }}>
      <input
        name="standard"
        value={value}
        onChange={(e) => { onChange(e); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        placeholder="CCSS.MATH.CONTENT.5.NF.B.3 — type a code or keywords"
        autoComplete="off"
        required
      />
      {open && suggestions.length > 0 && (
        <div className="bf-card" style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          marginTop: 4, padding: 0, maxHeight: 240, overflowY: 'auto',
        }}>
          {suggestions.map((s) => (
            <button
              key={s.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange({ target: { name: 'standard', value: `${s.code} — ${s.title}` } })
                setOpen(false)
              }}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', background: 'transparent',
                border: 'none', borderBottom: '1px solid var(--line)',
                color: 'var(--text)', cursor: 'pointer', fontSize: '0.9em',
              }}
            >
              <strong style={{ color: 'var(--accent)' }}>{s.code}</strong>
              <span style={{ opacity: 0.6, marginLeft: 8 }}>{s.subject} · gr {s.gradeBand}</span>
              <div style={{ fontSize: '0.85em', opacity: 0.8 }}>{s.title}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LessonForgeTab() {
  const [form, setForm] = useState({
    title: '', dueDate: '', description: '',
    standard: '', readingLevel: 'Grade 6-8', subject: 'ELA',
  })
  const [lesson,      setLesson]      = useState(null)
  const [savedLessonId, setSavedLessonId] = useState(null)
  const [accepted,    setAccepted]    = useState({}) // { 'foundational::OVERVIEW': true }
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [saveNotice,  setSaveNotice]  = useState(null)
  const [activeTab,   setActiveTab]   = useState('foundational')

  function markAccepted(key) {
    setAccepted((prev) => ({ ...prev, [key]: true }))
  }

  function updateField(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(null); setLesson(null); setSaveNotice(null); setAccepted({}); setSavedLessonId(null)
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
        setSavedLessonId(saveResult.lesson.id)
        setSaveNotice({
          kind: 'success',
          message: `Saved as a draft in LessonForge Drafts (lesson ID: ${saveResult.lesson.id})`,
        })
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
        Paste a standard to create a differentiated 3-tier lesson with activities, quiz checks, and vocabulary supports.
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
            <StandardAutocomplete value={form.standard} onChange={updateField} />
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
                <span style={{ marginLeft: '0.75rem', fontSize: '0.7em', padding: '3px 9px', borderRadius: '999px', background: 'rgba(255,159,67,0.15)', color: '#ffd4a6', border: '1px solid rgba(255,159,67,0.3)', verticalAlign: 'middle' }}>AI-generated</span>
              </h3>

              <h4 style={{ display: 'flex', alignItems: 'center' }}>
                Overview
                <AcceptButton lessonId={savedLessonId} level={activeTab} section="OVERVIEW"
                  aiVersion={currentTier.overview} accepted={accepted} onAccept={markAccepted} />
              </h4>
              <p>{currentTier.overview}</p>

              {currentTier.keyVocabulary?.length > 0 && (
                <>
                  <h4 style={{ display: 'flex', alignItems: 'center' }}>
                    Key vocabulary
                    <AcceptButton lessonId={savedLessonId} level={activeTab} section="KEY_VOCABULARY"
                      aiVersion={currentTier.keyVocabulary} accepted={accepted} onAccept={markAccepted} />
                  </h4>
                  <ul className="item-list compact">
                    {currentTier.keyVocabulary.map(v => (
                      <li key={v.term}><strong>{v.term}</strong><small>{v.definition}</small></li>
                    ))}
                  </ul>
                </>
              )}

              <h4 style={{ display: 'flex', alignItems: 'center' }}>
                Lesson content
                <AcceptButton lessonId={savedLessonId} level={activeTab} section="MAIN_CONTENT"
                  aiVersion={currentTier.mainContent} accepted={accepted} onAccept={markAccepted} />
              </h4>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{currentTier.mainContent}</div>

              {currentTier.activities?.length > 0 && (
                <>
                  <h4 style={{ display: 'flex', alignItems: 'center' }}>
                    Activities
                    <AcceptButton lessonId={savedLessonId} level={activeTab} section="ACTIVITIES"
                      aiVersion={currentTier.activities} accepted={accepted} onAccept={markAccepted} />
                  </h4>
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
                  <h4 style={{ display: 'flex', alignItems: 'center' }}>
                    Quiz + answer key
                    <AcceptButton lessonId={savedLessonId} level={activeTab} section="QUIZ"
                      aiVersion={currentTier.quiz} accepted={accepted} onAccept={markAccepted} />
                  </h4>
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
            {loading ? 'Adapting content…' : 'Adapt Content'}
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
