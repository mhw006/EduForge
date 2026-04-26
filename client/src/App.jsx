import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import AssignmentBreakdown from './pages/AssignmentBreakdown'
import StudyMode from './pages/StudyMode'
import BonfireProgress from './pages/BonfireProgress'

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/" className="brand-title">
          EduForge
        </Link>

        <nav>
          <NavLink to="/dashboard">Teacher Dashboard</NavLink>
          <NavLink to="/lesson-planner">Lesson Planner</NavLink>
          <NavLink to="/adapt-studio">Adapt Studio</NavLink>
          <NavLink to="/progress">Growth Tracker</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lesson-planner" element={<AssignmentBreakdown />} />
        <Route path="/adapt-studio" element={<StudyMode />} />
        <Route path="/progress" element={<BonfireProgress />} />

        <Route path="/assignment" element={<AssignmentBreakdown />} />
        <Route path="/study-mode" element={<StudyMode />} />
      </Routes>
    </div>
  )
}
