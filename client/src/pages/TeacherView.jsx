import { useEffect, useMemo, useState } from 'react'
import BonfireWidget from '../components/BonfireWidget'
import DashboardCard from '../components/DashboardCard'
import TaskChecklist from '../components/TaskChecklist'
import { adaptContent, getClassAnalytics, getClasses, createClass, getClassRoster, deleteClass, getDashboardData, getLessonsByClass, getLesson, recommendNextFocusTask, generateLessonPlan, saveGeneratedLesson, publishLesson, unpublishLesson, logLessonEdit, deleteLesson, getClassDiagnosticSummary, overrideStudentLevel } from '../services/aiClient'

// ─── Tab IDs ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',   icon: '📊', label: 'Dashboard'    },
  { id: 'lessonforge', icon: '🧠', label: 'LessonForge'  },
  { id: 'classes',     icon: '🏫', label: 'Classes'      },
  { id: 'adapt',       icon: '⚒️', label: 'The Anvil'    },
]

const READING_LEVELS = ['FOUNDATIONAL', 'GRADE_LEVEL', 'ADVANCED']
const MATH_LEVELS    = ['BELOW_GRADE', 'GRADE_LEVEL', 'ADVANCED']

function fmtLevel(val) {
  if (!val) return '—'
  return val.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function levelColor(level) {
  if (!level) return '#6b7280'
  if (level === 'FOUNDATIONAL' || level === 'BELOW_GRADE') return '#f87171'
  if (level === 'ADVANCED') return '#4ade80'
  return '#60a5fa'
}

function summarizeStandard(standard) {
  if (!standard) return 'Learning goal ready for live differentiation'
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
  if (!metrics) return <p className="sv-muted">Activity will appear here once students open lessons or take quizzes.</p>

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
  if (!analytics?.insights) return <p className="sv-muted">Insights will appear once students start opening lessons.</p>

  const { insights, readingLevelDistribution, lessonEngagement } = analytics
  const readingMix = readingLevelDistribution?.length
    ? readingLevelDistribution.map((row) => `${prettyLabel(row.level)} (${row.count})`).join(' · ')
    : 'No learner profiles yet'

  return (
    <ul className="item-list compact">
      <li>
        <strong>Most viewed lesson</strong>
        <span>{insights.mostViewedLesson?.title || 'No lesson views yet'}</span>
        <small>{insights.mostViewedLesson ? `${insights.mostViewedLesson.views} views` : 'Waiting on student traffic — publish a lesson and students open it'}</small>
      </li>
      <li>
        <strong>Lowest performing level</strong>
        <span>{prettyLabel(insights.lowestPerformingLevel)}</span>
        <small>
          {insights.avgQuizScoreOverall != null
            ? `Average quiz score across the class: ${insights.avgQuizScoreOverall}%. This is the reading tier where quiz scores are lowest — where students need the most support.`
            : 'Publish a lesson that includes a quiz and have students attempt it — then this will show which tier is struggling most.'}
        </small>
      </li>
      <li>
        <strong>Teacher rewrite hotspot</strong>
        <span>{prettyLabel(insights.mostEditedSection)}</span>
        <small>
          {analytics.editSectionSummary?.length
            ? 'The lesson section you edit most often after AI generation. When you change an Overview, Vocabulary, or Quiz block instead of accepting it, EduForge logs the edit. The section logged most is the hotspot — it tells you where the AI needs the most improvement for your class.'
            : 'Open a lesson in LessonForge and use the Accept or edit the generated sections. Every change is logged, and the most-changed section appears here.'}
        </small>
      </li>
      <li>
        <strong>Reading-level mix</strong>
        <span>{readingMix}</span>
        <small>
          How your enrolled students are distributed across Foundational, Grade Level, and Advanced reading tiers based on their diagnostic results.
          {lessonEngagement?.length ? ` ${lessonEngagement.length} published lesson${lessonEngagement.length !== 1 ? 's' : ''} ready for students.` : ' No published lessons yet.'}
        </small>
      </li>
    </ul>
  )
}

function StudentSignalsCard({ analytics }) {
  if (!analytics?.loopMetrics) {
    return <p className="sv-muted">Student data will appear once they take a diagnostic, open a lesson, or finish a quiz.</p>
  }

  const topEvent = analytics.insights?.topEventType
  const mathMix = analytics.mathLevelDistribution?.length
    ? analytics.mathLevelDistribution.map((row) => `${prettyLabel(row.level)} (${row.count})`).join(' · ')
    : 'No math profile data yet'

  return (
    <ul className="item-list compact">
      <li>
        <strong>Support watchlist</strong>
        <span>{analytics.insights?.studentsNeedingSupport || 0} {analytics.insights?.studentsNeedingSupport === 1 ? 'student is' : 'students are'} flagged for foundational support</span>
        <small>
          Students score Foundational on a reading or Below Grade on a math diagnostic and are flagged here. Go to the Classes tab to see exactly who they are and override their lesson level.
          {analytics.loopMetrics.diagnosticsCompleted > 0 ? ` ${analytics.loopMetrics.diagnosticsCompleted} diagnostic${analytics.loopMetrics.diagnosticsCompleted !== 1 ? 's' : ''} completed so far.` : ' No diagnostics completed yet — share the student diagnostic link.'}
        </small>
      </li>
      <li>
        <strong>Top student behavior</strong>
        <span>{prettyEventLabel(topEvent)}</span>
        <small>
          The single most common action students take inside lessons — e.g. switching language, toggling audio, changing bandwidth, or starting a quiz. Tells you what accessibility features your class actually uses.
          {` ${analytics.loopMetrics.engagementEvents} total events logged.`}
        </small>
      </li>
      <li>
        <strong>Math-level mix</strong>
        <span>{mathMix}</span>
        <small>
          How your students are split across Below Grade, Grade Level, and Advanced math tiers based on their latest math diagnostic. Use this to decide how much scaffolding to add to your next math lesson.
          {` ${analytics.loopMetrics.studentsTracked} student profile${analytics.loopMetrics.studentsTracked !== 1 ? 's' : ''} tracked.`}
        </small>
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
    return (
      <div>
        <p className="sv-muted" style={{ marginBottom: '0.5rem' }}>Recommendations will appear after diagnostics, edits, and engagement data come in.</p>
        <small className="sv-muted">These are generated by Claude based on your class data — diagnostic scores, quiz results, which lesson sections you rewrote, and how students engage with lessons.</small>
      </div>
    )
  }

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '0.75rem', fontSize: '0.82em' }}>
        Ranked actions generated by Claude from your class's diagnostic scores, quiz results, lesson edits, and engagement patterns.
      </p>
      <ul className="item-list compact">
        {suggestions.map((item, index) => (
          <li key={`${index}-${item.slice(0, 20)}`}>
            <strong>{index === 0 ? '1 · Highest priority' : `${index + 1} · Next move`}</strong>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ─── Class Management: create, share invite link, view roster, delete ────────
function ClassManagementCard({ classes, primaryClassId, onChange }) {
  const [newClassName, setNewClassName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [roster, setRoster] = useState(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [copyState, setCopyState] = useState(null)
  const activeClass = classes.find((c) => c.id === primaryClassId)

  useEffect(() => {
    if (!activeClass) { setRoster(null); return }
    let cancelled = false
    setRosterLoading(true)
    getClassRoster(activeClass.id)
      .then((r) => { if (!cancelled) setRoster(r) })
      .catch(() => { if (!cancelled) setRoster(null) })
      .finally(() => { if (!cancelled) setRosterLoading(false) })
    return () => { cancelled = true }
  }, [activeClass?.id])

  function buildInviteLink(joinCode) {
    return `${window.location.origin}/join?code=${encodeURIComponent(joinCode)}`
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!newClassName.trim()) return
    setCreating(true); setCreateError(null)
    try {
      await createClass(newClassName.trim())
      setNewClassName('')
      onChange?.()
    } catch (err) {
      setCreateError(err.message || 'Could not create class.')
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(cls) {
    const lessonNote = cls.lessonCount > 0 ? ` This will also remove ${cls.lessonCount} lesson(s).` : ''
    if (!confirm(`Delete "${cls.name}"?${lessonNote} This cannot be undone.`)) return
    try {
      await deleteClass(cls.id, { force: cls.lessonCount > 0 })
      onChange?.()
    } catch (err) {
      alert(`Could not delete class: ${err.message}`)
    }
  }

  async function copyToClipboard(text, label) {
    try {
      await navigator.clipboard.writeText(text)
      setCopyState({ label, ok: true })
    } catch {
      setCopyState({ label, ok: false })
    }
    setTimeout(() => setCopyState(null), 2000)
  }

  return (
    <div>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem' }}>
        <input
          value={newClassName}
          onChange={(e) => setNewClassName(e.target.value)}
          placeholder="New class name (e.g., 6th Grade Science)"
          style={{ flex: 1 }}
          maxLength={100}
        />
        <button type="submit" className="bf-btn" disabled={creating || !newClassName.trim()}>
          {creating ? 'Creating…' : 'Create class'}
        </button>
      </form>
      {createError && <p style={{ color: '#f87171', marginBottom: '0.5rem' }}>{createError}</p>}

      {classes.length === 0 ? (
        <p className="sv-muted">No classes yet. Create one above to get a student join code.</p>
      ) : (
        <ul className="item-list compact" style={{ marginBottom: '0.75rem' }}>
          {classes.map((cls) => (
            <li key={cls.id}>
              <div>
                <strong>{cls.name}</strong>
                <small>
                  {cls.studentCount || 0} {cls.studentCount === 1 ? 'student' : 'students'}
                  {' · '}
                  {cls.lessonCount || 0} {cls.lessonCount === 1 ? 'lesson' : 'lessons'}
                </small>
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="bf-btn ghost"
                  onClick={() => copyToClipboard(cls.joinCode, `code-${cls.id}`)}
                  title="Copy the join code so students can paste it on the Student page"
                >
                  {copyState?.label === `code-${cls.id}` ? (copyState.ok ? '✓ Code copied' : 'Copy failed') : `Code: ${cls.joinCode.slice(0, 8)}…`}
                </button>
                <button
                  type="button"
                  className="bf-btn ghost"
                  onClick={() => copyToClipboard(buildInviteLink(cls.joinCode), `link-${cls.id}`)}
                  title="Copy a one-click invite link"
                >
                  {copyState?.label === `link-${cls.id}` ? (copyState.ok ? '✓ Link copied' : 'Copy failed') : 'Copy invite link'}
                </button>
                <button
                  type="button"
                  className="bf-btn ghost"
                  onClick={() => handleDelete(cls)}
                  style={{ color: '#f87171' }}
                  title="Delete this class permanently"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {activeClass && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle, #2a2a2a)' }}>
          <strong style={{ display: 'block', marginBottom: '0.25rem' }}>Roster · {activeClass.name}</strong>
          {rosterLoading && <p className="sv-muted">Loading students…</p>}
          {!rosterLoading && roster?.students?.length === 0 && (
            <p className="sv-muted">No students enrolled yet. Share the join code or invite link above.</p>
          )}
          {!rosterLoading && roster?.students?.length > 0 && (
            <ul className="item-list compact">
              {roster.students.map((s) => (
                <li key={s.id}>
                  <strong>{s.email}</strong>
                  <small>Joined {new Date(s.joinedAt).toLocaleDateString()}</small>
                </li>
              ))}
            </ul>
          )}
        </div>
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
  const [loading,         setLoading]         = useState(true)
  const [classesRefreshKey, setClassesRefreshKey] = useState(0)

  // Re-fetch classes after create/delete in ClassManagementCard
  async function refreshClasses() {
    try {
      const r = await getClasses()
      const next = r?.classes || []
      setClasses(next)
      // If current selection vanished, fall back to first
      if (next.length > 0 && !next.find((c) => c.id === primaryClassId)) {
        setPrimaryClassId(next[0].id)
      }
      if (next.length === 0) setPrimaryClassId(null)
      setClassesRefreshKey((k) => k + 1)
    } catch { /* ignore */ }
  }

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
      try {
        const analyticsResult = await getClassAnalytics(primaryClassId)
        if (!cancelled) {
          setClassAnalytics(analyticsResult)
        }
      } catch {
        if (!cancelled) setClassAnalytics(null)
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
          + Forge Lesson
        </button>
        <button className="bf-btn ghost" type="button" onClick={() => onNavigate('adapt')}>
          Open The Anvil
        </button>
      </div>

      <p style={{ marginBottom: '1.25rem', color: 'var(--muted)' }}>
        Welcome back. This dashboard shows what your students need, what you have changed in your AI-generated lessons, and what to do next.
      </p>

      {classes.length > 0 && (
        <div style={{ marginBottom: '1rem', maxWidth: '280px' }}>
          <label style={{ display: 'grid', gap: '6px' }}>
            <span className="sv-muted">Active class</span>
            <select value={primaryClassId || ''} onChange={(e) => setPrimaryClassId(e.target.value)}>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      <section className="bf-card recommendation-strip" style={{ marginBottom: '12px' }}>
        <h3>Class overview</h3>
        <p>
          {activeClassName
            ? `Tracking how ${activeClassName} students engage with lessons, the edits you make to AI drafts, and the next supports we recommend.`
            : 'Pick a class to see student engagement, your edits to AI drafts, and recommended next steps.'}
        </p>
        <span>Diagnostics, adaptation, engagement, quizzes, and teacher edits all feed this view.</span>
      </section>

      <section className="dashboard-grid">
        <DashboardCard title="My Classes & Invites">
          <ClassManagementCard
            key={classesRefreshKey}
            classes={classes}
            primaryClassId={primaryClassId}
            onChange={refreshClasses}
          />
        </DashboardCard>

        <DashboardCard title="Classroom Snapshot">
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
                <span>Forge in LessonForge to create a stored draft, then publish when you're ready.</span>
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

function LessonForgeTab() {
  const [form, setForm] = useState({
    title: '', dueDate: '', description: '',
    standard: '', readingLevel: 'Grade 6-8', subject: 'ELA',
  })
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [lesson,      setLesson]      = useState(null)
  const [savedLessonId, setSavedLessonId] = useState(null)
  const [publishedLesson, setPublishedLesson] = useState(false)
  const [savedLessons, setSavedLessons] = useState([])
  const [accepted,    setAccepted]    = useState({}) // { 'foundational::OVERVIEW': true }
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [saveNotice,  setSaveNotice]  = useState(null)
  const [activeTab,   setActiveTab]   = useState('foundational')

  useEffect(() => {
    let cancelled = false
    async function loadClassesAndLessons() {
      try {
        const result = await getClasses()
        if (cancelled) return
        const availableClasses = (result.classes || []).filter((cls) => cls.name !== 'LessonForge Drafts')
        setClasses(availableClasses)
        setSelectedClassId(availableClasses[0]?.id || '')

        const lessonResults = await Promise.all(
          availableClasses.map(async (cls) => {
            const lessonResult = await getLessonsByClass(cls.id)
            return (lessonResult.lessons || []).map((savedLesson) => ({
              ...savedLesson,
              classId: cls.id,
              className: cls.name,
            }))
          })
        )
        if (!cancelled) {
          setSavedLessons(
            lessonResults
              .flat()
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
          )
        }
      } catch {
        if (!cancelled) {
          setClasses([])
          setSavedLessons([])
        }
      }
    }
    loadClassesAndLessons()
    return () => { cancelled = true }
  }, [])

  function markAccepted(key) {
    setAccepted((prev) => ({ ...prev, [key]: true }))
  }

  function updateField(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(null); setLesson(null); setSaveNotice(null); setAccepted({}); setSavedLessonId(null); setPublishedLesson(false)
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
          classId: selectedClassId || undefined,
          className: classes.find((cls) => cls.id === selectedClassId)?.name || 'LessonForge Drafts',
          title: form.title,
          standard: form.standard,
          lesson: result,
        })
        setSavedLessonId(saveResult.lesson.id)
        setSaveNotice({
          kind: 'success',
          message: selectedClassId
            ? `Saved as a draft in ${classes.find((cls) => cls.id === selectedClassId)?.name || 'your class'} (lesson ID: ${saveResult.lesson.id})`
            : `Saved as a draft in LessonForge Drafts (lesson ID: ${saveResult.lesson.id})`,
        })
        setSavedLessons((prev) => [
          {
            ...saveResult.lesson,
            classId: selectedClassId || saveResult.lesson.classId,
            className: classes.find((cls) => cls.id === (selectedClassId || saveResult.lesson.classId))?.name || 'LessonForge Drafts',
          },
          ...prev.filter((item) => item.id !== saveResult.lesson.id),
        ])
      } catch (saveErr) {
        setSaveNotice({ kind: 'error', message: `Forged successfully, but save failed: ${saveErr.message || 'Unknown error'}` })
      }
    } catch (err) {
      setError(err.message || 'Forging failed. Check your connection and try again.')
    } finally { setLoading(false) }
  }

  async function handlePublishLesson() {
    if (!savedLessonId) return
    try {
      await publishLesson(savedLessonId)
      setPublishedLesson(true)
      setSaveNotice({
        kind: 'success',
        message: `Published and ready for students in ${classes.find((cls) => cls.id === selectedClassId)?.name || 'this class'}.`,
      })
      setSavedLessons((prev) => prev.map((item) => item.id === savedLessonId ? { ...item, publishedAt: new Date().toISOString() } : item))
    } catch (err) {
      setSaveNotice({ kind: 'error', message: `Draft saved, but publish failed: ${err.message || 'Unknown error'}` })
    }
  }

  async function openSavedLesson(lessonSummary) {
    try {
      setError(null)
      const lessonResult = await getLesson(lessonSummary.id, 'teacher')
      setLesson(lessonResult)
      setSavedLessonId(lessonSummary.id)
      setPublishedLesson(Boolean(lessonSummary.publishedAt))
      setActiveTab('foundational')
      setSaveNotice({
        kind: 'success',
        message: lessonSummary.publishedAt
          ? `Reopened published lesson from ${lessonSummary.className}.`
          : `Reopened draft from ${lessonSummary.className}. Publish it when you're ready.`,
      })
      if (lessonSummary.classId) setSelectedClassId(lessonSummary.classId)
    } catch (err) {
      setSaveNotice({ kind: 'error', message: `Could not reopen saved lesson: ${err.message || 'Unknown error'}` })
    }
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
        Enter a standard or topic and EduForge generates three reading levels, vocabulary, activities, and a quiz.
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
            Learning goal or topic
            <input
              name="standard"
              value={form.standard}
              onChange={updateField}
              placeholder="Example: Compare fractions with unlike denominators using visual models"
              required
            />
          </label>

          <label>
            Target reading level
            <select name="readingLevel" value={form.readingLevel} onChange={updateField}>
              <option>Grade 1-3</option><option>Grade 4-5</option><option>Grade 6-8</option>
              <option>Grade 9-12</option><option>Lexile 900+</option>
            </select>
          </label>

          <label>
            Publish to class
            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
              {classes.length === 0 ? (
                <option value="">Save to LessonForge Drafts</option>
              ) : (
                classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>{cls.name}</option>
                ))
              )}
            </select>
          </label>

          <label className="full-width">
            Teacher notes (optional)
            <textarea name="description" value={form.description} onChange={updateField}
              placeholder="ELL supports needed, IEP accommodations, multilingual classroom…" />
          </label>

          <button className="bf-btn" type="submit" disabled={loading}>
            {loading ? 'Forging lesson…' : 'Forge Differentiated Lesson'}
          </button>
        </form>

        {loading && (
          <div className="bf-card" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '1.8rem' }}>⚒️</div>
            <div>
              <strong>Forging at the anvil…</strong>
              <div className="sv-muted">Generating three reading levels, vocabulary, activities, and a quiz.</div>
            </div>
          </div>
        )}

        {error && <p style={{ color: '#f87171', marginTop: '1rem' }}>{error}</p>}
        {saveNotice && (
          <p style={{ color: saveNotice.kind === 'success' ? '#4ade80' : '#facc15', marginTop: '0.75rem' }}>
            {saveNotice.message}
          </p>
        )}
      </section>

      <section className="bf-card" style={{ marginTop: '12px' }}>
        <h3 style={{ marginTop: 0 }}>Saved lessons</h3>
        <p className="sv-muted" style={{ marginBottom: '0.75rem' }}>
          Reopen a saved draft to publish it later or review what students can already access.
        </p>
        <ul className="item-list compact">
          {savedLessons.length > 0 ? (
            savedLessons.slice(0, 8).map((savedLesson) => (
              <li key={savedLesson.id}>
                <div>
                  <strong>{savedLesson.title}</strong>
                  <small>{savedLesson.className} · {savedLesson.publishedAt ? 'Published' : 'Draft'}</small>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" className="bf-btn ghost" onClick={() => openSavedLesson(savedLesson)}>
                    Open
                  </button>
                  <button
                    type="button"
                    className="bf-btn ghost"
                    style={{ color: '#fca5a5' }}
                    onClick={async () => {
                      if (!confirm(`Delete "${savedLesson.title}"? This cannot be undone.`)) return
                      try {
                        await deleteLesson(savedLesson.id)
                        setSavedLessons((prev) => prev.filter((item) => item.id !== savedLesson.id))
                        if (savedLessonId === savedLesson.id) setSavedLessonId(null)
                        setSaveNotice({ kind: 'success', message: `"${savedLesson.title}" deleted.` })
                      } catch (err) {
                        setSaveNotice({ kind: 'error', message: `Could not delete: ${err.message}` })
                      }
                    }}
                  >
                    Delete
                  </button>
                  {!savedLesson.publishedAt ? (
                    <button
                      type="button"
                      className="bf-btn"
                      onClick={async () => {
                        await publishLesson(savedLesson.id)
                        setSaveNotice({ kind: 'success', message: `${savedLesson.title} is now published for students.` })
                        setSavedLessons((prev) => prev.map((item) => item.id === savedLesson.id ? { ...item, publishedAt: new Date().toISOString() } : item))
                      }}
                    >
                      Publish
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="bf-btn ghost"
                      onClick={async () => {
                        if (!confirm(`Unpublish "${savedLesson.title}"? Students will no longer see this lesson.`)) return
                        try {
                          await unpublishLesson(savedLesson.id)
                          setSaveNotice({ kind: 'success', message: `${savedLesson.title} is now a draft. Students can't see it.` })
                          setSavedLessons((prev) => prev.map((item) => item.id === savedLesson.id ? { ...item, publishedAt: null } : item))
                        } catch (err) {
                          setSaveNotice({ kind: 'error', message: `Could not unpublish: ${err.message}` })
                        }
                      }}
                    >
                      Unpublish
                    </button>
                  )}
                </div>
              </li>
            ))
          ) : (
            <li>
              <strong>No saved lessons yet</strong>
              <small>Forge a lesson above and it will stay here as a draft until you publish it.</small>
            </li>
          )}
        </ul>
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
                {savedLessonId && (
                  <button type="button" className="bf-btn" onClick={handlePublishLesson} disabled={publishedLesson}>
                    {publishedLesson ? 'Published' : 'Publish for Students'}
                  </button>
                )}
                <button type="button" className="bf-btn ghost" onClick={() => window.print()}>Export PDF</button>
              </div>
            </div>

            <div className="pill-row" style={{ marginTop: '1.5rem', flexWrap: 'wrap', gap: '8px' }}>
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
              {savedLessonId && (
                <button
                  type="button"
                  className="bf-btn ghost"
                  style={{ marginLeft: 'auto', fontSize: '0.8em' }}
                  onClick={async () => {
                    if (!confirm('Accept all sections in all three tiers as-is? This logs them to the feedback loop.')) return
                    const allSections = ['OVERVIEW', 'KEY_VOCABULARY', 'MAIN_CONTENT', 'ACTIVITIES', 'QUIZ']
                    const allTiers = ['foundational', 'gradeLevel', 'advanced']
                    const newAccepted = { ...accepted }
                    await Promise.all(
                      allTiers.flatMap(tier =>
                        allSections.map(async section => {
                          const key = SECTION_LEVEL_KEY(tier, section)
                          if (newAccepted[key]) return
                          const aiVersion = lesson?.[tier]?.[section.toLowerCase().replace(/_([a-z])/g, (_, c) => c.toUpperCase())]
                          if (!aiVersion) return
                          await logLessonEdit({ lessonId: savedLessonId, level: levelKeyToEnum(tier), section, editType: 'ACCEPTED_AS_IS', aiVersion, humanVersion: aiVersion }).catch(() => null)
                          newAccepted[key] = true
                        })
                      )
                    )
                    setAccepted(newAccepted)
                    setSaveNotice({ kind: 'success', message: 'All sections accepted and logged to the feedback loop.' })
                  }}
                >
                  Accept All
                </button>
              )}
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
        Temper any content to a learner profile in real time — language, reading level, accessibility — no separate version management needed.
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
            {loading ? 'Tempering content…' : 'Temper Content'}
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

// ─── Classes Tab ─────────────────────────────────────────────────────────────
function ClassesTab() {
  const [classes, setClasses] = useState([])
  const [loading, setLoading] = useState(true)
  const [newClassName, setNewClassName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(null)
  const [expandedClassId, setExpandedClassId] = useState(null)
  const [classData, setClassData] = useState({}) // classId → { students, loading, error, overriding }
  const [copyState, setCopyState] = useState(null)

  async function loadClasses() {
    try {
      const r = await getClasses()
      setClasses(r.classes || [])
    } catch { setClasses([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadClasses() }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!newClassName.trim()) return
    setCreating(true); setCreateError(null)
    try {
      await createClass(newClassName.trim())
      setNewClassName('')
      loadClasses()
    } catch (err) {
      setCreateError(err.message || 'Could not create class.')
    } finally { setCreating(false) }
  }

  async function handleDelete(cls) {
    const note = cls.lessonCount > 0 ? ` This will also remove ${cls.lessonCount} lesson(s).` : ''
    if (!confirm(`Delete "${cls.name}"?${note} This cannot be undone.`)) return
    try {
      await deleteClass(cls.id, { force: cls.lessonCount > 0 })
      setClasses(prev => prev.filter(c => c.id !== cls.id))
      if (expandedClassId === cls.id) setExpandedClassId(null)
    } catch (err) { alert(`Could not delete: ${err.message}`) }
  }

  async function toggleExpand(cls) {
    if (expandedClassId === cls.id) { setExpandedClassId(null); return }
    setExpandedClassId(cls.id)
    if (classData[cls.id]) return
    setClassData(prev => ({ ...prev, [cls.id]: { loading: true, students: null, error: null } }))
    try {
      const summary = await getClassDiagnosticSummary(cls.id)
      setClassData(prev => ({ ...prev, [cls.id]: { loading: false, students: summary.students || [], error: null } }))
    } catch (err) {
      setClassData(prev => ({ ...prev, [cls.id]: { loading: false, students: [], error: err.message } }))
    }
  }

  async function handleOverride(classId, studentId, field, value) {
    const key = `${classId}:${studentId}:${field}`
    setClassData(prev => ({ ...prev, [classId]: { ...prev[classId], overriding: key } }))
    try {
      await overrideStudentLevel(classId, studentId, { [field]: value })
      setClassData(prev => ({
        ...prev,
        [classId]: {
          ...prev[classId],
          overriding: null,
          students: (prev[classId].students || []).map(s =>
            s.userId === studentId
              ? { ...s, currentProfile: { ...s.currentProfile, [field]: value } }
              : s
          ),
        },
      }))
    } catch (err) {
      alert(`Could not update: ${err.message}`)
      setClassData(prev => ({ ...prev, [classId]: { ...prev[classId], overriding: null } }))
    }
  }

  function buildInviteLink(joinCode) {
    return `${window.location.origin}/join?code=${encodeURIComponent(joinCode)}`
  }

  async function copyText(text, label) {
    try { await navigator.clipboard.writeText(text); setCopyState({ label, ok: true }) }
    catch { setCopyState({ label, ok: false }) }
    setTimeout(() => setCopyState(null), 2000)
  }

  if (loading) return <p className="sv-muted">Loading classes…</p>

  return (
    <div>
      <section className="bf-card" style={{ marginBottom: '12px' }}>
        <h2 style={{ marginTop: 0 }}>Create a class</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={newClassName}
            onChange={e => setNewClassName(e.target.value)}
            placeholder="e.g. 6th Grade Science — Period 2"
            style={{ flex: 1, minWidth: '200px' }}
            maxLength={100}
          />
          <button className="bf-btn" type="submit" disabled={creating || !newClassName.trim()}>
            {creating ? 'Creating…' : 'Create class'}
          </button>
        </form>
        {createError && <p style={{ color: '#f87171', marginTop: '6px' }}>{createError}</p>}
      </section>

      {classes.length === 0 ? (
        <section className="bf-card">
          <p className="sv-muted">No classes yet. Create one above to get a student join code.</p>
        </section>
      ) : (
        classes.map(cls => {
          const isOpen = expandedClassId === cls.id
          const data = classData[cls.id] || {}
          return (
            <section key={cls.id} className="bf-card" style={{ marginBottom: '12px' }}>
              {/* ── Class header row ── */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => toggleExpand(cls)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0, color: 'inherit', textAlign: 'left', flex: 1 }}
                >
                  <span style={{ marginRight: '8px' }}>{isOpen ? '▾' : '▸'}</span>
                  <strong>{cls.name}</strong>
                  <span className="sv-muted" style={{ marginLeft: '10px', fontSize: '0.85em' }}>
                    {cls.studentCount || 0} student{cls.studentCount !== 1 ? 's' : ''} · {cls.lessonCount || 0} lesson{cls.lessonCount !== 1 ? 's' : ''}
                  </span>
                </button>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" className="bf-btn ghost"
                    onClick={() => copyText(cls.joinCode, `code-${cls.id}`)}>
                    {copyState?.label === `code-${cls.id}` ? (copyState.ok ? '✓ Copied' : 'Failed') : `Code: ${cls.joinCode}`}
                  </button>
                  <button type="button" className="bf-btn ghost"
                    onClick={() => copyText(buildInviteLink(cls.joinCode), `link-${cls.id}`)}>
                    {copyState?.label === `link-${cls.id}` ? (copyState.ok ? '✓ Copied' : 'Failed') : 'Invite link'}
                  </button>
                  <button type="button" className="bf-btn ghost" style={{ color: '#f87171' }}
                    onClick={() => handleDelete(cls)}>
                    Delete
                  </button>
                </div>
              </div>

              {/* ── Expanded student list ── */}
              {isOpen && (
                <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-subtle, #2a2a2a)', paddingTop: '1rem' }}>
                  {data.loading && <p className="sv-muted">Loading students…</p>}
                  {data.error && <p style={{ color: '#fca5a5' }}>{data.error}</p>}
                  {!data.loading && data.students?.length === 0 && (
                    <p className="sv-muted">No students enrolled yet. Share the join code or invite link.</p>
                  )}
                  {!data.loading && data.students?.length > 0 && (
                    <>
                      <p className="sv-muted" style={{ marginBottom: '0.75rem', fontSize: '0.85em' }}>
                        Red = needs support · Blue = grade level · Green = advanced. Use the dropdowns to override a student's lesson level.
                      </p>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-subtle, #2a2a2a)', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Student</th>
                              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Reading</th>
                              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Math</th>
                              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Science</th>
                              <th style={{ padding: '6px 8px', fontWeight: 600 }}>Override level</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.students.map(s => {
                              const rLevel = s.currentProfile?.readingLevel || null
                              const mLevel = s.currentProfile?.mathLevel || null
                              const overrideKey = `${cls.id}:${s.userId}`
                              return (
                                <tr key={s.userId} style={{ borderBottom: '1px solid var(--border-subtle, #1a1a1a)' }}>
                                  <td style={{ padding: '8px 8px' }}>
                                    <span>{s.email}</span>
                                    {(s.reading?.inferredLevel === 'FOUNDATIONAL' || s.math?.inferredLevel === 'BELOW_GRADE') && (
                                      <span style={{ marginLeft: '6px', fontSize: '0.75em', color: '#f87171' }}>⚠ needs support</span>
                                    )}
                                  </td>
                                  <td style={{ padding: '8px 8px' }}>
                                    {s.reading ? (
                                      <span style={{ color: levelColor(s.reading.inferredLevel) }}>
                                        {fmtLevel(s.reading.inferredLevel)}
                                        <small style={{ display: 'block', color: '#6b7280' }}>{s.reading.score}/{s.reading.totalQuestions}</small>
                                      </span>
                                    ) : <span className="sv-muted">No diagnostic</span>}
                                  </td>
                                  <td style={{ padding: '8px 8px' }}>
                                    {s.math ? (
                                      <span style={{ color: levelColor(s.math.inferredLevel) }}>
                                        {fmtLevel(s.math.inferredLevel)}
                                        <small style={{ display: 'block', color: '#6b7280' }}>{s.math.score}/{s.math.totalQuestions}</small>
                                      </span>
                                    ) : <span className="sv-muted">No diagnostic</span>}
                                  </td>
                                  <td style={{ padding: '8px 8px' }}>
                                    {s.science ? (
                                      <span style={{ color: levelColor(s.science.inferredLevel) }}>
                                        {fmtLevel(s.science.inferredLevel)}
                                        <small style={{ display: 'block', color: '#6b7280' }}>{s.science.score}/{s.science.totalQuestions}</small>
                                      </span>
                                    ) : <span className="sv-muted">No diagnostic</span>}
                                  </td>
                                  <td style={{ padding: '8px 8px' }}>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                                      <label style={{ fontSize: '0.8em', color: '#9ca3af' }}>
                                        Reading
                                        <select
                                          value={rLevel || ''}
                                          disabled={data.overriding === `${overrideKey}:readingLevel`}
                                          onChange={e => handleOverride(cls.id, s.userId, 'readingLevel', e.target.value)}
                                          style={{ display: 'block', marginTop: '2px', fontSize: '0.85em' }}
                                        >
                                          <option value="">— keep —</option>
                                          {READING_LEVELS.map(l => <option key={l} value={l}>{fmtLevel(l)}</option>)}
                                        </select>
                                      </label>
                                      <label style={{ fontSize: '0.8em', color: '#9ca3af' }}>
                                        Math
                                        <select
                                          value={mLevel || ''}
                                          disabled={data.overriding === `${overrideKey}:mathLevel`}
                                          onChange={e => handleOverride(cls.id, s.userId, 'mathLevel', e.target.value)}
                                          style={{ display: 'block', marginTop: '2px', fontSize: '0.85em' }}
                                        >
                                          <option value="">— keep —</option>
                                          {MATH_LEVELS.map(l => <option key={l} value={l}>{fmtLevel(l)}</option>)}
                                        </select>
                                      </label>
                                    </div>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          )
        })
      )}
    </div>
  )
}

// ─── Sidebar FAQ ─────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'What is a Diagnostic?',
    a: 'A short 13-question placement quiz students take in Reading, Math, or Science. Results set the student\'s level (Foundational → Grade Level → Advanced) so EduForge knows which version of a lesson to show them.',
  },
  {
    q: 'What does "Foundational" mean?',
    a: 'A student scored below 40% on a diagnostic. Their lessons are simplified — shorter sentences, key vocabulary highlighted, more scaffolding. Think of it as the support tier.',
  },
  {
    q: 'What is Grade Level?',
    a: 'The middle tier. Students scored 40–79% and receive the standard lesson version. Most students start here.',
  },
  {
    q: 'What is Advanced?',
    a: 'Students scored 80%+ and receive enriched content — more depth, higher-order questions, and less scaffolding.',
  },
  {
    q: 'What is the Teacher Rewrite Hotspot?',
    a: 'Every time you edit a section of an AI-generated lesson instead of accepting it, EduForge logs the change. The hotspot is the section you\'ve changed most often — it shows where the AI drafts need the most human correction for your class.',
  },
  {
    q: 'What is the Closed-Loop / Feedback Loop?',
    a: 'The cycle where student diagnostic results adapt lessons → teachers edit AI drafts → those edits improve future generation → students retake diagnostics. Every action feeds data back into the system.',
  },
  {
    q: 'What is LessonForge?',
    a: 'The AI lesson generator. You enter a topic or learning standard and EduForge generates three reading-level versions of the lesson (Foundational, Grade Level, Advanced) with vocabulary, activities, and a quiz — all in one go.',
  },
  {
    q: 'What does "Accept" / "Accept All" do?',
    a: 'Marks an AI-generated section as correct as-is without editing it. This logs a positive signal to the feedback loop — the system learns what it got right. Accept All logs every section across all three levels at once.',
  },
  {
    q: 'What is a Reading-Level Mix?',
    a: 'A count of how many students are in each reading tier based on their latest diagnostic. E.g. "Foundational (3) · Grade Level (12) · Advanced (5)" tells you 3 students need extra support in your next lesson.',
  },
  {
    q: 'What is a Math-Level Mix?',
    a: 'Same idea as reading-level mix but for math. Math uses Below Grade / Grade Level / Advanced. Use this to decide how much scaffolding to add when forging a math lesson.',
  },
  {
    q: 'What is the Support Watchlist count?',
    a: 'The number of students who scored Foundational (reading) or Below Grade (math) on their latest diagnostic. Open the Classes tab to see their names and override their lesson level manually.',
  },
  {
    q: 'What are Recommended Actions / Next Moves?',
    a: 'Actions ranked by Claude based on your class\'s live data — diagnostic scores, quiz results, which lesson sections you rewrote, and how students use lessons. They update each time you load the dashboard.',
  },
  {
    q: 'What is Top Student Behavior?',
    a: 'The most common action students perform inside lessons — switching language, turning on audio, changing bandwidth, or starting a quiz. It tells you which accessibility features your class actually relies on.',
  },
  {
    q: 'What is the Join Code?',
    a: 'A short code students enter in the Student View → My Classes tab to enroll in your class. You can also share the invite link which auto-fills the code.',
  },
  {
    q: 'What is Bandwidth Mode?',
    a: 'A student setting that controls how media-rich their lesson is. Full = images and audio. Reduced = fewer images. Text Only = plain text only, for low-connectivity situations.',
  },
  {
    q: 'What is The Anvil?',
    a: 'The adapt studio. Paste any topic and set a learner profile — language, reading level, accessibility needs — and EduForge tempers the content live without saving a permanent lesson.',
  },
]

function SidebarFAQ() {
  const [open, setOpen] = useState(false)
  const [expandedIndex, setExpandedIndex] = useState(null)

  function toggle(i) {
    setExpandedIndex(prev => prev === i ? null : i)
  }

  return (
    <div className="sidebar-faq">
      <button
        type="button"
        className="sidebar-faq-toggle"
        onClick={() => { setOpen(o => !o); setExpandedIndex(null) }}
        aria-expanded={open}
      >
        <span>❓</span>
        <span>Help & Glossary</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.8em', opacity: 0.7 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="sidebar-faq-panel">
          <p className="sidebar-faq-intro">Tap any term to expand it.</p>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="sidebar-faq-item">
              <button
                type="button"
                className="sidebar-faq-question"
                onClick={() => toggle(i)}
                aria-expanded={expandedIndex === i}
              >
                <span>{item.q}</span>
                <span style={{ fontSize: '0.75em', opacity: 0.6, flexShrink: 0 }}>{expandedIndex === i ? '▴' : '▾'}</span>
              </button>
              {expandedIndex === i && (
                <p className="sidebar-faq-answer">{item.a}</p>
              )}
            </div>
          ))}
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
      case 'classes':     return <ClassesTab />
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
        <div style={{ marginTop: 'auto', paddingTop: '16px' }}>
          <SidebarFAQ />
        </div>
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
