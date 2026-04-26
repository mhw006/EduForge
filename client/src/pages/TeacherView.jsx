import { useEffect, useMemo, useState } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import BonfireWidget from '../components/BonfireWidget'
import DashboardCard from '../components/DashboardCard'
import TaskChecklist from '../components/TaskChecklist'
import {
  adaptContent, getClasses, getDashboardData, getLessonsByClass,
  recommendNextFocusTask, generateLessonPlan, saveGeneratedLesson,
  logLessonEdit, getEditSummary, searchStandards,
  getLoopStatus, getClassRecommendations, getClassAnalytics,
} from '../services/aiClient'

// ─── Tab IDs ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard',   icon: '📊', label: 'Dashboard'      },
  { id: 'analytics',   icon: '📈', label: 'Analytics'      },
  { id: 'intelligence',icon: '🧩', label: 'Intelligence'   },
  { id: 'lessonforge', icon: '🧠', label: 'LessonForge'    },
  { id: 'adapt',       icon: '🎯', label: 'Adapt Studio'   },
]

// ─── Loop Overview widget ─────────────────────────────────────────────────────
const STEP_STATUS_ICON = { complete: '✓', partial: '◑', pending: '○', action: '→' }
const STEP_STATUS_COLOR = { complete: '#4ade80', partial: '#facc15', pending: '#6b7280', action: '#60a5fa' }

function LoopOverviewWidget({ classId }) {
  const [loop,    setLoop]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classId) {
      // Use mock data when no class is selected yet
      setLoop({
        className: 'Demo Class',
        steps: [
          { id: 'standards',       label: 'Standards matched',        status: 'complete', count: 3,  detail: '3 lessons generated'    },
          { id: 'diagnostics',     label: 'Diagnostics completed',    status: 'partial',  count: 7,  total: 12, detail: '7/12 students' },
          { id: 'adaptations',     label: 'Adaptations applied',      status: 'complete', count: 11, detail: '11 lessons adapted'     },
          { id: 'signals',         label: 'Student signals captured',  status: 'complete', count: 34, detail: '34 engagement events'   },
          { id: 'quiz',            label: 'Quiz responses recorded',   status: 'complete', count: 28, detail: '28 quiz responses'      },
          { id: 'teacher_feedback',label: 'Teacher feedback logged',   status: 'complete', count: 8,  detail: '8 section edits'        },
        ],
        nextAction: 'Run diagnostics for 5 remaining students',
        loopHealth: 5,
        totalSteps: 6,
        _mock: true,
      })
      setLoading(false)
      return
    }
    getLoopStatus(classId)
      .then(setLoop)
      .catch(() => setLoop(null))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) return <p className="sv-muted">Loading loop status…</p>
  if (!loop)   return <p className="sv-muted">No class data available yet.</p>

  const healthPct = loop.totalSteps ? Math.round((loop.loopHealth / loop.totalSteps) * 100) : 0

  return (
    <div>
      {loop._mock && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>
          Showing demo data — select a class to see live loop status.
        </p>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>{loop.className}</span>
        <span style={{
          fontSize: '0.8rem', fontWeight: 700,
          color: healthPct >= 80 ? '#4ade80' : healthPct >= 50 ? '#facc15' : '#f87171',
        }}>
          Loop health: {loop.loopHealth}/{loop.totalSteps}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {loop.steps.map((step) => (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700, fontSize: '1rem', minWidth: 18,
              color: STEP_STATUS_COLOR[step.status] || '#6b7280',
            }}>
              {STEP_STATUS_ICON[step.status] || '○'}
            </span>
            <span style={{ flex: 1, fontSize: '0.85rem' }}>{step.label}</span>
            <span style={{
              fontSize: '0.75rem', color: STEP_STATUS_COLOR[step.status],
              fontVariantNumeric: 'tabular-nums',
            }}>
              {step.detail}
            </span>
          </div>
        ))}
      </div>

      <div style={{
        marginTop: '0.75rem', padding: '0.5rem 0.75rem',
        background: 'rgba(96,165,250,0.1)', borderLeft: '3px solid #60a5fa',
        borderRadius: 4, fontSize: '0.82rem', color: '#93c5fd',
      }}>
        → {loop.nextAction}
      </div>
    </div>
  )
}

// ─── Analytics charts (Recharts) ──────────────────────────────────────────────
const READING_COLORS  = { FOUNDATIONAL: '#f472b6', GRADE_LEVEL: '#60a5fa', ADVANCED: '#4ade80' }
const CONNECT_COLORS  = { low: '#f87171', medium: '#facc15', high: '#4ade80', FULL: '#4ade80', REDUCED: '#facc15', TEXT_ONLY: '#f87171' }
const READING_LABELS  = { FOUNDATIONAL: 'Foundational', GRADE_LEVEL: 'Grade Level', ADVANCED: 'Advanced' }

function ReadingDistChart({ data }) {
  if (!data || data.length === 0) {
    data = [
      { level: 'FOUNDATIONAL', count: 4 },
      { level: 'GRADE_LEVEL',  count: 6 },
      { level: 'ADVANCED',     count: 2 },
    ]
  }
  const chartData = data.map((d) => ({ name: READING_LABELS[d.level] || d.level, value: d.count }))
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((entry, i) => (
            <Cell key={i} fill={Object.values(READING_COLORS)[i % 3]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  )
}

function ConnectivityDistChart({ data }) {
  // Use mock connectivity data since it comes from chat sessions (not DB profiles)
  const chartData = data && data.length > 0 ? data : [
    { name: 'Low bandwidth', value: 3 },
    { name: 'Standard',      value: 7 },
    { name: 'Full media',    value: 2 },
  ]
  const COLORS = ['#f87171', '#facc15', '#4ade80']
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" outerRadius={70} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

function EngagementBarChart({ data }) {
  const chartData = data && data.length > 0
    ? data.map((d) => ({ name: d.eventType.replace('_', ' '), count: d.count }))
    : [
        { name: 'VIEW',           count: 34 },
        { name: 'QUIZ COMPLETE',  count: 18 },
        { name: 'LANGUAGE TOGGLE',count: 7  },
        { name: 'TTS TOGGLE',     count: 5  },
      ]
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted)' }} angle={-25} textAnchor="end" />
        <YAxis tick={{ fontSize: 11, fill: 'var(--muted)' }} />
        <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 6 }} />
        <Bar dataKey="count" fill="#60a5fa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ─── Closed-Loop Intelligence panel ──────────────────────────────────────────
function IntelligencePanel({ classId }) {
  const [recs,    setRecs]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classId) {
      setRecs({
        recommendations: [
          '3 students need foundational support in Fractions before moving to Ratios',
          'Consider simplifying the Introduction section — it was rewritten by 4 teachers',
          '2 students have not completed a diagnostic — prompt them before next lesson',
        ],
        detectedIssues: [
          'Students struggled with: Equivalent Fractions, Ratios',
          'Most rewritten AI section: MAIN_CONTENT (4 times)',
          'Low-bandwidth students who may need offline resources: 3',
        ],
        urgentAction: null,
        _mock: true,
      })
      setLoading(false)
      return
    }
    getClassRecommendations(classId)
      .then(setRecs)
      .catch(() => setRecs(null))
      .finally(() => setLoading(false))
  }, [classId])

  if (loading) return <p className="sv-muted">Analyzing class data…</p>
  if (!recs)   return <p className="sv-muted">No recommendations available yet.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {recs._mock && (
        <p style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
          Showing demo recommendations — select a class to see live insights.
        </p>
      )}

      {recs.detectedIssues?.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
            What the AI detected this session
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {recs.detectedIssues.map((issue, i) => (
              <li key={i} style={{ fontSize: '0.85rem', color: '#fca5a5' }}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ borderTop: '1px solid var(--line)', paddingTop: '0.75rem' }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
          Recommended next actions
        </h4>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {recs.recommendations.map((rec, i) => (
            <li key={i} style={{
              display: 'flex', gap: '0.5rem', alignItems: 'flex-start',
              padding: '0.5rem 0.75rem',
              background: 'rgba(96,165,250,0.08)', borderRadius: 6, fontSize: '0.85rem',
            }}>
              <span style={{ color: '#60a5fa', fontWeight: 700, minWidth: 16 }}>▶</span>
              <span>{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {recs.urgentAction && (
        <div style={{
          padding: '0.6rem 0.9rem',
          background: 'rgba(248,113,113,0.12)', border: '1px solid #f87171',
          borderRadius: 6, fontSize: '0.85rem', color: '#fca5a5',
        }}>
          <strong>Urgent:</strong> {recs.urgentAction}
        </div>
      )}
    </div>
  )
}

// ─── Analytics tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ classId }) {
  const [analytics, setAnalytics] = useState(null)
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!classId) { setLoading(false); return }
    getClassAnalytics(classId).then(setAnalytics).catch(() => setAnalytics(null)).finally(() => setLoading(false))
  }, [classId])

  const readingDist = analytics?.readingLevelDistribution || []
  const engageCounts = analytics?.engagementCounts || []

  const adaptationActivity = {
    totalAdapted: 11,
    lowBandwidth: 3,
    simplifiedLanguage: 5,
  }

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>
        Class-wide engagement and equity distribution — the visual story behind who EduForge serves.
      </p>

      {/* Adaptation Activity banner */}
      <div className="bf-card" style={{ marginBottom: 12 }}>
        <h3 style={{ marginBottom: '0.5rem' }}>Adaptation Activity</h3>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div><small className="sv-muted">Lessons adapted</small><h3 style={{ margin: 0, color: '#4ade80' }}>{adaptationActivity.totalAdapted}</h3></div>
          <div><small className="sv-muted">Low-bandwidth mode</small><h3 style={{ margin: 0, color: '#facc15' }}>{adaptationActivity.lowBandwidth} students</h3></div>
          <div><small className="sv-muted">Simplified language</small><h3 style={{ margin: 0, color: '#60a5fa' }}>{adaptationActivity.simplifiedLanguage} students</h3></div>
        </div>
      </div>

      <div className="dashboard-grid">
        <DashboardCard title="Reading Level Distribution">
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
            Who is in each tier — the equity story in one chart.
          </p>
          <ReadingDistChart data={readingDist} />
        </DashboardCard>

        <DashboardCard title="Connectivity Distribution">
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
            How students connect — drives the bandwidth adaptation layer.
          </p>
          <ConnectivityDistChart data={[]} />
        </DashboardCard>

        <DashboardCard title="Student Engagement Events">
          <EngagementBarChart data={engageCounts} />
        </DashboardCard>

        <DashboardCard title="Loop Overview">
          <LoopOverviewWidget classId={classId} />
        </DashboardCard>
      </div>
    </div>
  )
}

// ─── Intelligence tab ─────────────────────────────────────────────────────────
function IntelligenceTab({ classId }) {
  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1rem' }}>
        EduForge surfaces classroom signals and turns them into recommended actions — closing the loop between AI generation and teacher intent.
      </p>

      <div className="dashboard-grid">
        <DashboardCard title="Classroom Intelligence">
          <IntelligencePanel classId={classId} />
        </DashboardCard>

        <DashboardCard title="EduForge Loop Status">
          <LoopOverviewWidget classId={classId} />
        </DashboardCard>
      </div>

      {/* AI vs Teacher diff section */}
      <div className="bf-card" style={{ marginTop: 12 }}>
        <h3>AI vs Teacher: Section Edit Patterns</h3>
        <p className="sv-muted" style={{ marginBottom: '0.75rem' }}>
          Every teacher edit is a signal. These patterns are fed back into future lesson generation.
        </p>
        <EditDiffSummary classId={classId} />
      </div>
    </div>
  )
}

function EditDiffSummary({ classId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!classId) {
      setSummary({
        totalEdits: 8,
        acceptanceRate: 0.62,
        avgCharDelta: 184,
        bySection: [
          { section: 'MAIN_CONTENT', accepted_as_is: 1, modified: 3, regenerated: 1, total: 5 },
          { section: 'OVERVIEW',     accepted_as_is: 2, modified: 1, regenerated: 0, total: 3 },
        ],
        _mock: true,
      })
      setLoading(false)
      return
    }
    getEditSummary({ classId }).then(setSummary).catch(() => setSummary(null)).finally(() => setLoading(false))
  }, [classId])

  if (loading) return <p className="sv-muted">Loading edit data…</p>
  if (!summary || summary.totalEdits === 0) return (
    <p className="sv-muted">
      No edit telemetry yet. In LessonForge, click <strong>Accept</strong> on any section to start populating this panel.
    </p>
  )

  const EDIT_LABELS = {
    accepted_as_is: { label: 'Accepted',  color: '#4ade80' },
    modified:       { label: 'Modified',  color: '#facc15' },
    regenerated:    { label: 'Regenerated',color: '#f87171' },
  }

  return (
    <div>
      {summary._mock && <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Demo data</p>}

      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <div><small className="sv-muted">Total edits</small><h3 style={{ margin: 0 }}>{summary.totalEdits}</h3></div>
        <div>
          <small className="sv-muted">AI acceptance rate</small>
          <h3 style={{ margin: 0, color: summary.acceptanceRate > 0.7 ? '#4ade80' : '#facc15' }}>
            {Math.round(summary.acceptanceRate * 100)}%
          </h3>
        </div>
        <div><small className="sv-muted">Avg edit size</small><h3 style={{ margin: 0 }}>{summary.avgCharDelta} chars</h3></div>
      </div>

      {summary.bySection?.length > 0 && (
        <div>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>By section:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {summary.bySection.map((s) => {
              const total = s.total || 1
              return (
                <div key={s.section} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ width: 120, fontSize: '0.82rem', color: 'var(--muted)' }}>
                    {s.section.toLowerCase().replace('_', ' ')}
                  </span>
                  <div style={{ flex: 1, display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden' }}>
                    {Object.entries(EDIT_LABELS).map(([key, { label, color }]) => {
                      const count = s[key] || 0
                      const pct = (count / total) * 100
                      return pct > 0 ? (
                        <div key={key} title={`${label}: ${count}`} style={{ width: `${pct}%`, background: color }} />
                      ) : null
                    })}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', minWidth: 40 }}>{total} edits</span>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            {Object.entries(EDIT_LABELS).map(([, { label, color }]) => (
              <span key={label} style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: color, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dashboard tab ────────────────────────────────────────────────────────────
const accessibilityCoverage = [
  { id: 'ac1', group: 'Multilingual learners',     coverage: '4/6 lessons adapted this week'  },
  { id: 'ac2', group: 'IEP / 504 supports',        coverage: '3/6 lessons adapted this week'  },
  { id: 'ac3', group: 'Foundational level students', coverage: '5/6 lessons adapted this week' },
]

function summarizeStandard(standard) {
  if (!standard) return 'Standard ready for live differentiation'
  return standard.length > 110 ? `${standard.slice(0, 107)}...` : standard
}

function EditFlywheelWidget({ classId }) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    if (!classId) { setLoading(false); return }
    getEditSummary({ classId }).then(setSummary).catch(() => setSummary(null)).finally(() => setLoading(false))
  }, [classId])
  if (loading) return <p className="sv-muted">Loading edit metrics…</p>
  if (!summary || summary.totalEdits === 0) return (
    <p className="sv-muted">
      No edit telemetry yet. Open LessonForge, generate a lesson, and click <strong>Accept</strong> on any section.
    </p>
  )
  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem' }}>
        <div><small className="sv-muted">Total edits</small><h3 style={{ margin: 0 }}>{summary.totalEdits}</h3></div>
        <div>
          <small className="sv-muted">Acceptance rate</small>
          <h3 style={{ margin: 0, color: summary.acceptanceRate > 0.7 ? '#4ade80' : '#facc15' }}>
            {Math.round(summary.acceptanceRate * 100)}%
          </h3>
        </div>
        <div><small className="sv-muted">Avg edit size</small><h3 style={{ margin: 0 }}>{summary.avgCharDelta} chars</h3></div>
      </div>
      {summary.bySection?.length > 0 && (
        <ul className="item-list compact" style={{ marginTop: '0.5rem' }}>
          {summary.bySection.slice(0, 5).map((s) => (
            <li key={s.section}>
              <strong>{s.section.replace('_', ' ').toLowerCase()}</strong>
              <small>{s.accepted_as_is || 0} accepted · {s.modified || 0} edited · {s.regenerated || 0} regenerated</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DashboardTab({ onNavigate, primaryClassId }) {
  const [data,            setData]            = useState(null)
  const [recommendation,  setRecommendation]  = useState(null)
  const [curriculumQueue, setCurriculumQueue] = useState([])
  const [loading,         setLoading]         = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const dashboard = await getDashboardData()
        setData(dashboard)
        try { setRecommendation(await recommendNextFocusTask({ fuelPoints: dashboard.progress?.fuelPoints || 0, missedDays: 0 })) } catch { setRecommendation(null) }
        try {
          const classesResponse = await getClasses()
          const classes = classesResponse?.classes || []
          if (classes.length === 0) return
          const lessonResults = await Promise.all(
            classes.map(async (cls) => {
              const lr = await getLessonsByClass(cls.id)
              return (lr?.lessons || []).map((l) => ({
                id: l.id, title: l.title,
                source: summarizeStandard(l.standard),
                status: `${cls.name} · ${l.publishedAt ? 'Published' : 'Draft'}`,
                createdAt: l.createdAt, publishedAt: l.publishedAt,
              }))
            })
          )
          setCurriculumQueue(
            lessonResults.flat()
              .filter((l) => l.publishedAt)
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .slice(0, 4)
          )
        } catch { setCurriculumQueue([]) }
      } finally { setLoading(false) }
    }
    load()
  }, [])

  const focusTasks = useMemo(() => data?.todayFocusTasks?.map((t) => ({ ...t, completed: t.done })) || [], [data])
  const [taskState, setTaskState] = useState([])
  useEffect(() => { setTaskState(focusTasks) }, [focusTasks])
  function toggleTask(id) { setTaskState((prev) => prev.map((t) => t.id === id ? { ...t, completed: !t.completed } : t)) }
  const completed = taskState.filter((t) => t.completed).length

  if (loading) return <p className="sv-muted">Loading dashboard…</p>

  return (
    <div>
      <div className="header-actions" style={{ marginBottom: '1.25rem' }}>
        <button className="bf-btn" type="button" onClick={() => onNavigate('lessonforge')}>+ New Lesson Plan</button>
        <button className="bf-btn ghost" type="button" onClick={() => onNavigate('analytics')}>View Analytics</button>
        <button className="bf-btn ghost" type="button" onClick={() => onNavigate('intelligence')}>Intelligence Panel</button>
      </div>

      <p style={{ marginBottom: '1.25rem', color: 'var(--muted)' }}>
        Welcome back, Teacher. Generate a lesson, publish it, then switch to the student view to show adaptation in real time.
      </p>

      <section className="dashboard-grid">
        <DashboardCard title="Today's Teacher Actions" action={<small>{completed}/{taskState.length} completed</small>}>
          <TaskChecklist tasks={taskState} onToggle={toggleTask} />
        </DashboardCard>

        <DashboardCard title="EduForge Loop Status">
          <LoopOverviewWidget classId={primaryClassId} />
        </DashboardCard>

        <DashboardCard title="Recent Published Lessons">
          <ul className="item-list compact">
            {curriculumQueue.length > 0 ? (
              curriculumQueue.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <span>{item.source}</span>
                  <small>{item.status}</small>
                </li>
              ))
            ) : (
              <li>
                <strong>No published lessons yet</strong>
                <span>Generate in LessonForge, then publish to populate this panel.</span>
              </li>
            )}
          </ul>
        </DashboardCard>

        <DashboardCard title="Accessibility Coverage">
          <ul className="item-list compact">
            {accessibilityCoverage.map((item) => (
              <li key={item.id}><strong>{item.group}</strong><small>{item.coverage}</small></li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard title="Class Learning Momentum">
          <BonfireWidget progress={{ fuelPoints: (data?.progress?.fuelPoints || 0) + completed * 10, studySessions: completed, missedDays: 0 }} />
        </DashboardCard>

        <DashboardCard title="AI vs Final Edits (Data Flywheel)">
          <EditFlywheelWidget classId={primaryClassId} />
        </DashboardCard>
      </section>

      {recommendation && (
        <section className="bf-card recommendation-strip" style={{ marginTop: 12 }}>
          <h3>Recommended Demo Move</h3>
          <p>{recommendation.recommendation}</p>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>Suggested support mode: {recommendation.mode}</span>
        </section>
      )}
    </div>
  )
}

// ─── LessonForge tab ──────────────────────────────────────────────────────────
const GRADE_MAP = { 'Grade 1-3':'2','Grade 4-5':'4','Grade 6-8':'6','Grade 9-12':'10','Lexile 900+':'12' }
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
        const result = await logLessonEdit({ lessonId, level: levelKeyToEnum(level), section, editType: 'ACCEPTED_AS_IS', aiVersion, humanVersion: aiVersion })
        if (result) onAccept(key)
      }}
      title="Mark this section as accepted (logs telemetry for the data flywheel)"
    >
      {isAccepted ? '✓ Accepted' : 'Accept'}
    </button>
  )
}

function levelKeyToEnum(key) {
  return { foundational:'FOUNDATIONAL', gradeLevel:'GRADE_LEVEL', advanced:'ADVANCED' }[key] || 'GRADE_LEVEL'
}

function StandardAutocomplete({ value, onChange }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!value || value.length < 2) { setSuggestions([]); return }
    const t = setTimeout(async () => {
      try { setSuggestions((await searchStandards(value, 6)).standards || []) } catch { setSuggestions([]) }
    }, 250)
    return () => clearTimeout(t)
  }, [value])
  return (
    <div style={{ position: 'relative' }}>
      <input name="standard" value={value} onChange={(e) => { onChange(e); setOpen(true) }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 200)} placeholder="CCSS.MATH.CONTENT.5.NF.B.3 — type a code or keywords" autoComplete="off" required />
      {open && suggestions.length > 0 && (
        <div className="bf-card" style={{ position:'absolute',top:'100%',left:0,right:0,zIndex:10,marginTop:4,padding:0,maxHeight:240,overflowY:'auto' }}>
          {suggestions.map((s) => (
            <button key={s.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange({ target: { name:'standard', value:`${s.code} — ${s.title}` } }); setOpen(false) }}
              style={{ display:'block',width:'100%',textAlign:'left',padding:'10px 12px',background:'transparent',border:'none',borderBottom:'1px solid var(--line)',color:'var(--text)',cursor:'pointer',fontSize:'0.9em' }}>
              <strong style={{ color:'var(--accent)' }}>{s.code}</strong>
              <span style={{ opacity:0.6,marginLeft:8 }}>{s.subject} · gr {s.gradeBand}</span>
              <div style={{ fontSize:'0.85em',opacity:0.8 }}>{s.title}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function LessonForgeTab() {
  const [form, setForm]               = useState({ title:'',dueDate:'',description:'',standard:'',readingLevel:'Grade 6-8',subject:'ELA' })
  const [lesson, setLesson]           = useState(null)
  const [savedLessonId, setSaved]     = useState(null)
  const [accepted, setAccepted]       = useState({})
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [saveNotice, setSaveNotice]   = useState(null)
  const [activeTab, setActiveTab]     = useState('foundational')

  function markAccepted(key) { setAccepted((prev) => ({ ...prev, [key]: true })) }
  function updateField(e) { const { name, value } = e.target; setForm((prev) => ({ ...prev, [name]: value })) }

  async function submit(e) {
    e.preventDefault(); setLoading(true); setError(null); setLesson(null); setSaveNotice(null); setAccepted({}); setSaved(null)
    try {
      const result = await generateLessonPlan({ standard: form.standard, gradeLevel: GRADE_MAP[form.readingLevel] || '6', subject: form.subject, description: form.description })
      setLesson(result); setActiveTab('foundational')
      try {
        const saveResult = await saveGeneratedLesson({ className: 'LessonForge Drafts', title: form.title, standard: form.standard, lesson: result })
        setSaved(saveResult.lesson.id)
        setSaveNotice({ kind: 'success', message: `Saved to PostgreSQL (lesson ID: ${saveResult.lesson.id})` })
      } catch (saveErr) {
        setSaveNotice({ kind: 'error', message: `Generated OK, but save failed: ${saveErr.message}` })
      }
    } catch (err) {
      setError(err.message || 'Generation failed. Check your connection and try again.')
    } finally { setLoading(false) }
  }

  const tabs = [{ key:'foundational',label:'Foundational',color:'#4ade80' },{ key:'gradeLevel',label:'Grade Level',color:'#60a5fa' },{ key:'advanced',label:'Advanced',color:'#f472b6' }]
  const currentTier = lesson?.[activeTab]

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1.25rem' }}>
        Paste a standard and Claude generates a fully differentiated 3-tier lesson with activities, quiz, and vocabulary.
      </p>
      <section className="bf-card">
        <form className="form-grid" onSubmit={submit}>
          <label>Lesson or unit title<input name="title" value={form.title} onChange={updateField} placeholder="Unit 3: Fractions and Ratios" /></label>
          <label>Subject<select name="subject" value={form.subject} onChange={updateField}><option>ELA</option><option>Math</option><option>Science</option><option>Social Studies</option><option>History</option><option>Art</option><option>Physical Education</option></select></label>
          <label>Curriculum standard<StandardAutocomplete value={form.standard} onChange={updateField} /></label>
          <label>Target reading level<select name="readingLevel" value={form.readingLevel} onChange={updateField}><option>Grade 1-3</option><option>Grade 4-5</option><option>Grade 6-8</option><option>Grade 9-12</option><option>Lexile 900+</option></select></label>
          <label className="full-width">Teacher notes (optional)<textarea name="description" value={form.description} onChange={updateField} placeholder="ELL supports needed, IEP accommodations, multilingual classroom…" /></label>
          <button className="bf-btn" type="submit" disabled={loading}>{loading ? 'Claude is generating…' : 'Generate Differentiated Lesson'}</button>
        </form>
        {error && <p style={{ color: '#f87171', marginTop: '1rem' }}>{error}</p>}
        {saveNotice && <p style={{ color: saveNotice.kind === 'success' ? '#4ade80' : '#facc15', marginTop: '0.75rem' }}>{saveNotice.message}</p>}
      </section>

      {lesson && (
        <>
          <section className="bf-card" style={{ marginTop: 12 }}>
            <div className="stack-header">
              <div>
                <h2>{lesson.title}</h2>
                <p style={{ opacity:0.7 }}>{lesson.subject} · Grade {lesson.targetGrade} · ~{lesson.estimatedMinutes} min · {lesson.standard}</p>
              </div>
              <div className="hero-cta-row"><button type="button" className="bf-btn ghost" onClick={() => window.print()}>Export PDF</button></div>
            </div>
            <div className="pill-row" style={{ marginTop: '1.5rem' }}>
              {tabs.map(({ key, label, color }) => (
                <button key={key} type="button" className={activeTab === key ? 'pill active' : 'pill'}
                  style={activeTab === key ? { borderColor: color, color } : {}} onClick={() => setActiveTab(key)}>{label}</button>
              ))}
            </div>
          </section>

          {currentTier && (
            <section className="bf-card lessonforge-output" style={{ marginTop: 12 }}>
              <h3 style={{ color: tabs.find((t) => t.key === activeTab)?.color }}>
                {currentTier.levelLabel} <small style={{ opacity:0.6,fontSize:'0.8em' }}>{currentTier.lexileRange}</small>
              </h3>
              <h4 style={{ display:'flex',alignItems:'center' }}>Overview<AcceptButton lessonId={savedLessonId} level={activeTab} section="OVERVIEW" aiVersion={currentTier.overview} accepted={accepted} onAccept={markAccepted} /></h4>
              <p>{currentTier.overview}</p>
              {currentTier.keyVocabulary?.length > 0 && (<>
                <h4 style={{ display:'flex',alignItems:'center' }}>Key vocabulary<AcceptButton lessonId={savedLessonId} level={activeTab} section="KEY_VOCABULARY" aiVersion={currentTier.keyVocabulary} accepted={accepted} onAccept={markAccepted} /></h4>
                <ul className="item-list compact">{currentTier.keyVocabulary.map((v) => <li key={v.term}><strong>{v.term}</strong><small>{v.definition}</small></li>)}</ul>
              </>)}
              <h4 style={{ display:'flex',alignItems:'center' }}>Lesson content<AcceptButton lessonId={savedLessonId} level={activeTab} section="MAIN_CONTENT" aiVersion={currentTier.mainContent} accepted={accepted} onAccept={markAccepted} /></h4>
              <div style={{ whiteSpace:'pre-wrap',lineHeight:1.7 }}>{currentTier.mainContent}</div>
              {currentTier.activities?.length > 0 && (<>
                <h4 style={{ display:'flex',alignItems:'center' }}>Activities<AcceptButton lessonId={savedLessonId} level={activeTab} section="ACTIVITIES" aiVersion={currentTier.activities} accepted={accepted} onAccept={markAccepted} /></h4>
                <ul className="item-list compact">{currentTier.activities.map((a) => <li key={a.title}><strong>{a.title} <small>({a.estimatedMinutes} min)</small></strong><span>{a.instructions}</span></li>)}</ul>
              </>)}
              {currentTier.quiz?.length > 0 && (<>
                <h4 style={{ display:'flex',alignItems:'center' }}>Quiz + answer key<AcceptButton lessonId={savedLessonId} level={activeTab} section="QUIZ" aiVersion={currentTier.quiz} accepted={accepted} onAccept={markAccepted} /></h4>
                <ol className="item-list compact">
                  {currentTier.quiz.map((q, i) => (
                    <li key={i}>
                      <strong>{q.question}</strong>
                      <ul style={{ marginTop:'0.25rem',paddingLeft:'1.25rem' }}>
                        {q.options.map((opt) => <li key={opt} style={{ color: opt.startsWith(q.correctAnswer) ? '#4ade80' : 'inherit' }}>{opt}</li>)}
                      </ul>
                      <small>Answer: {q.correctAnswer} — {q.explanation}</small>
                    </li>
                  ))}
                </ol>
              </>)}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ─── Adapt Studio tab ─────────────────────────────────────────────────────────
const MODE_ICONS = { visual:'👁', audio:'🔊', reading:'📖', interactive:'✋' }

function AdaptTab() {
  const [topic, setTopic]         = useState('')
  const [profile, setProfile]     = useState({ readingLevel:'Grade 6-8',language:'English',dyslexiaFont:false,highContrast:false,screenReader:false,bandwidth:'full-media' })
  const [adapted, setAdapted]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState(null)
  const [activeMode, setActiveMode] = useState('reading')

  function updateProfile(e) { const { name, value, type, checked } = e.target; setProfile((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value })) }

  async function submit(e) {
    e.preventDefault(); if (!topic.trim()) return
    setLoading(true); setError(null); setAdapted(null)
    try { const result = await adaptContent(topic, profile); setAdapted(result); setActiveMode('reading') }
    catch (err) { setError(err.message || 'Adaptation failed. Please try again.') }
    finally { setLoading(false) }
  }

  const currentMode = adapted?.studyModes?.find((m) => m.mode === activeMode)

  return (
    <div>
      <p className="sv-muted" style={{ marginBottom: '1.25rem' }}>
        Adapt any content to a learner profile in real time — language, reading level, accessibility — no separate version management needed.
      </p>
      <section className="bf-card">
        <h3>Learner profile</h3>
        <div className="profile-grid">
          <label>Reading level<select name="readingLevel" value={profile.readingLevel} onChange={updateProfile}><option>Grade 1-3</option><option>Grade 4-5</option><option>Grade 6-8</option><option>Grade 9-12</option><option>Lexile 900+</option></select></label>
          <label>Primary language<select name="language" value={profile.language} onChange={updateProfile}><option>English</option><option>Spanish</option><option>Mandarin</option><option>Tagalog</option><option>Arabic</option><option>Vietnamese</option><option>Korean</option><option>French</option><option>Portuguese</option><option>Hindi</option><option>Somali</option><option>Hmong</option></select></label>
          <label>Bandwidth mode<select name="bandwidth" value={profile.bandwidth} onChange={updateProfile}><option value="full-media">Full media</option><option value="reduced-media">Reduced media</option><option value="text-only">Text-only offline</option></select></label>
        </div>
        <div className="toggle-row">
          <label><input type="checkbox" name="dyslexiaFont" checked={profile.dyslexiaFont} onChange={updateProfile} /> Dyslexia-friendly formatting</label>
          <label><input type="checkbox" name="highContrast" checked={profile.highContrast} onChange={updateProfile} /> High contrast</label>
          <label><input type="checkbox" name="screenReader" checked={profile.screenReader} onChange={updateProfile} /> Screen reader mode</label>
        </div>
      </section>
      <section className="bf-card" style={{ marginTop: 12 }}>
        <form className="inline-form" onSubmit={submit}>
          <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter a lesson topic, standard, or paste content to adapt" required />
          <button className="bf-btn" type="submit" disabled={loading}>{loading ? 'Claude is adapting…' : 'Adapt Content'}</button>
        </form>
        {error && <p style={{ color:'#f87171',marginTop:'0.75rem' }}>{error}</p>}
      </section>
      {adapted && (
        <div className={`eduadapt-preview ${profile.highContrast ? 'high-contrast' : ''} ${profile.dyslexiaFont ? 'dyslexia-font' : ''}`} aria-live={profile.screenReader ? 'polite' : 'off'} style={{ marginTop: 12 }}>
          <article className="bf-card" style={{ padding:'0.75rem 1.25rem' }}>
            <p style={{ opacity:0.8,margin:0,fontSize:'0.875rem' }}>
              Adapted for: <strong>{adapted.accessibilityMeta?.language}</strong> · <strong>{adapted.accessibilityMeta?.appliedReadingLevel}</strong> · Bandwidth: <strong>{adapted.accessibilityMeta?.bandwidthMode}</strong>
            </p>
          </article>
          <article className="bf-card" style={{ marginTop: 12 }}>
            <h2>{adapted.adaptedTitle}</h2>
            <div style={{ whiteSpace:'pre-wrap',lineHeight: profile.dyslexiaFont ? 2 : 1.7 }}>{adapted.mainContent}</div>
          </article>
          {adapted.keyTerms?.length > 0 && (
            <article className="bf-card" style={{ marginTop: 12 }}>
              <h3>Key terms</h3>
              <ul className="item-list compact">{adapted.keyTerms.map((t) => <li key={t.term}><strong>{t.term}</strong><small>{t.definition}</small></li>)}</ul>
            </article>
          )}
          {adapted.studyModes?.length > 0 && (
            <article className="bf-card" style={{ marginTop: 12 }}>
              <h3>Study modes</h3>
              <div className="pill-row">{adapted.studyModes.map((m) => <button key={m.mode} type="button" className={activeMode === m.mode ? 'pill active' : 'pill'} onClick={() => setActiveMode(m.mode)}>{MODE_ICONS[m.mode]} {m.label}</button>)}</div>
              {currentMode && (
                <div className="mode-content" style={{ marginTop: '1rem' }}>
                  <p style={{ whiteSpace:'pre-wrap',lineHeight:1.7 }}>{currentMode.description}</p>
                  {currentMode.accessibilityNote && <small style={{ opacity:0.6,display:'block',marginTop:'0.5rem' }}>Accessibility: {currentMode.accessibilityNote}</small>}
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
  const [activeTab,      setActiveTab]      = useState('dashboard')
  const [primaryClassId, setPrimaryClassId] = useState(null)

  useEffect(() => {
    getClasses('teacher')
      .then((r) => { if (r?.classes?.length > 0) setPrimaryClassId(r.classes[0].id) })
      .catch(() => {})
  }, [])

  const current = TABS.find((t) => t.id === activeTab)

  function renderTab() {
    switch (activeTab) {
      case 'dashboard':    return <DashboardTab onNavigate={setActiveTab} primaryClassId={primaryClassId} />
      case 'analytics':    return <AnalyticsTab classId={primaryClassId} />
      case 'intelligence': return <IntelligenceTab classId={primaryClassId} />
      case 'lessonforge':  return <LessonForgeTab />
      case 'adapt':        return <AdaptTab />
      default:             return null
    }
  }

  return (
    <div className="sv-shell">
      <nav className="sv-sidebar">
        <p className="sv-sidebar-label">Teacher View</p>
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={`sv-tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
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
