import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardCard from '../components/DashboardCard'
import BonfireWidget from '../components/BonfireWidget'
import TaskChecklist from '../components/TaskChecklist'
import { getDashboardData, recommendNextFocusTask } from '../services/aiClient'

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
          <h1>Student Dashboard</h1>
          <p>Welcome back, {data?.studentName || 'student'}. Keep your focus fire burning.</p>
        </div>

        <div className="header-actions">
          <Link className="bf-btn" to="/assignment">
            Add Assignment
          </Link>
          <Link className="bf-btn" to="/exam-focus">
            Add Exam
          </Link>
          <Link className="bf-btn ghost" to="/study-mode">
            Start Focus Mode
          </Link>
        </div>
      </header>

      <section className="dashboard-grid">
        <DashboardCard title="Upcoming Assignments">
          <ul className="item-list">
            {(data?.upcomingAssignments || []).map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <span>{item.course}</span>
                <small>Due {item.dueDate}</small>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard title="Upcoming Exams">
          <ul className="item-list">
            {(data?.upcomingExams || []).map((item) => (
              <li key={item.id}>
                <strong>{item.name}</strong>
                <span>{item.course}</span>
                <small>{item.examDate}</small>
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard
          title="Today's Focus Tasks"
          action={<small>{completed}/{taskState.length} completed</small>}
        >
          <TaskChecklist tasks={taskState} onToggle={toggleTask} />
        </DashboardCard>

        <DashboardCard title="Bonfire Progress">
          <BonfireWidget
            progress={{
              fuelPoints: (data?.progress?.fuelPoints || 0) + completed * 10,
              studySessions: completed,
              missedDays: 0,
            }}
          />
          <Link className="text-link" to="/progress">View full progress</Link>
        </DashboardCard>
      </section>

      {recommendation ? (
        <section className="bf-card recommendation-strip">
          <h3>Recommended Next Focus Task</h3>
          <p>{recommendation.recommendation}</p>
          <span>Suggested mode: {recommendation.mode}</span>
        </section>
      ) : null}
    </main>
  )
}
