import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardCard from '../components/DashboardCard'
import BonfireWidget from '../components/BonfireWidget'
import TaskChecklist from '../components/TaskChecklist'
import { getDashboardData, recommendNextFocusTask } from '../services/aiClient'

const curriculumQueue = [
  { id: 'c1', title: 'Week 4 Algebra Slides', source: 'Google Classroom import', status: 'Ready to transform' },
  { id: 'c2', title: 'Cell Biology Lab Notes', source: 'Teacher upload', status: 'Needs language scaffolds' },
]

const accessibilityCoverage = [
  { id: 'ac1', group: 'Multilingual learners', coverage: '4/6 lessons adapted this week' },
  { id: 'ac2', group: 'IEP / 504 supports', coverage: '3/6 lessons adapted this week' },
  { id: 'ac3', group: 'Foundational level students', coverage: '5/6 lessons adapted this week' },
]

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const dashboard = await getDashboardData()
        setData(dashboard)

        const rec = await recommendNextFocusTask({
          fuelPoints: dashboard.progress?.fuelPoints || 0,
          missedDays: 0,
        })
        setRecommendation(rec)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const focusTasks = useMemo(() => {
    return data?.todayFocusTasks?.map((task) => ({
      ...task,
      completed: task.done,
    })) || []
  }, [data])

  const [taskState, setTaskState] = useState([])

  useEffect(() => {
    setTaskState(focusTasks)
  }, [focusTasks])

  function toggleTask(taskId) {
    setTaskState((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, completed: !task.completed } : task))
    )
  }

  const completed = taskState.filter((task) => task.completed).length

  if (loading) {
    return <main className="page-wrap">Loading dashboard...</main>
  }

  return (
    <main className="page-wrap">
      <header className="page-header">
        <div>
          <h1>Teacher Dashboard</h1>
          <p>Welcome back, {data?.studentName || 'teacher'}. Plan, differentiate, and monitor student growth.</p>
        </div>

        <div className="header-actions">
          <Link className="bf-btn" to="/lesson-planner">
            Upload Lesson Plan
          </Link>
          <Link className="bf-btn" to="/diagnostic">
            Create Diagnostic
          </Link>
          <Link className="bf-btn ghost" to="/adapt-studio">
            Open Adapt Studio
          </Link>
        </div>
      </header>

      <section className="dashboard-grid">
        <DashboardCard title="Upcoming Lesson Deliverables">
          <ul className="item-list">
            {(data?.upcomingAssignments || []).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.course}</span>
                <small>Prep by {item.dueDate}</small>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard title="Planned Assessments">
          <ul className="item-list">
            {(data?.upcomingExams || []).map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.course}</span>
                <small>Assessment date {item.examDate}</small>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard
          title="Today's Teacher Actions"
          action={<small>{completed}/{taskState.length} completed</small>}
        >
          <TaskChecklist tasks={taskState} onToggle={toggleTask} />
        </DashboardCard>

        <DashboardCard title="Curriculum Upload Queue">
          <ul className="item-list compact">
            {curriculumQueue.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.source}</span>
                <small>{item.status}</small>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard title="Accessibility Coverage">
          <ul className="item-list compact">
            {accessibilityCoverage.map((item) => (
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
          <Link className="text-link" to="/progress">View growth tracker</Link>
        </DashboardCard>
      </section>

      {recommendation ? (
        <section className="bf-card recommendation-strip">
          <h3>Recommended Next Teacher Action</h3>
          <p>{recommendation.recommendation}</p>
          <span>Suggested support mode: {recommendation.mode}</span>
        </section>
      ) : null}
    </main>
  )
}
