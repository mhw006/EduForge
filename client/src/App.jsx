import { Link, NavLink, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import AssignmentBreakdown from './pages/AssignmentBreakdown'
import StudyMode from './pages/StudyMode'
import StudentView from './pages/StudentView'

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
          <NavLink to="/student">Student View</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/lesson-planner" element={<AssignmentBreakdown />} />
        <Route path="/adapt-studio" element={<StudyMode />} />
        <Route path="/student" element={<StudentView />} />

        <Route path="/assignment" element={<AssignmentBreakdown />} />
        <Route path="/study-mode" element={<StudyMode />} />
        <Route path="/progress" element={<StudentView />} />
      </Routes>
    </div>
  )
}
