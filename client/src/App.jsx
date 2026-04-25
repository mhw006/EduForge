import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import AssignmentBreakdown from './pages/AssignmentBreakdown'
import ExamFocus from './pages/ExamFocus'
import StudyMode from './pages/StudyMode'
import BonfireProgress from './pages/BonfireProgress'

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/" className="brand-title">
          🔥 Bonfire
        </Link>

        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/assignment">Assignment</NavLink>
          <NavLink to="/exam-focus">Exam Focus</NavLink>
          <NavLink to="/study-mode">Study Mode</NavLink>
          <NavLink to="/progress">Progress</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/assignment" element={<AssignmentBreakdown />} />
        <Route path="/exam-focus" element={<ExamFocus />} />
        <Route path="/study-mode" element={<StudyMode />} />
        <Route path="/progress" element={<BonfireProgress />} />
      </Routes>
    </div>
  )
}
