import { Link, NavLink, Route, Routes, Navigate } from 'react-router-dom'
import Landing from './pages/Landing'
import TeacherView from './pages/TeacherView'
import StudentView from './pages/StudentView'
import JoinClass from './pages/JoinClass'

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-topbar">
        <Link to="/" className="brand-title">
          EduForge
        </Link>

        <nav>
          <NavLink to="/teacher">Teacher View</NavLink>
          <NavLink to="/student">Student View</NavLink>
        </nav>
      </header>

      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/teacher" element={<TeacherView />} />
        <Route path="/student" element={<StudentView />} />
        <Route path="/join" element={<JoinClass />} />

        {/* Legacy redirects */}
        <Route path="/dashboard"    element={<Navigate to="/teacher" replace />} />
        <Route path="/lesson-planner" element={<Navigate to="/teacher" replace />} />
        <Route path="/adapt-studio" element={<Navigate to="/teacher" replace />} />
        <Route path="/progress"     element={<Navigate to="/student" replace />} />
        <Route path="/assignment"   element={<Navigate to="/teacher" replace />} />
        <Route path="/study-mode"   element={<Navigate to="/teacher" replace />} />
      </Routes>
    </div>
  )
}
