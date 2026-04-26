const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function handleResponse(response) {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }
  return response.json()
}

export async function getDashboardData() {
  const response = await fetch(`${API_BASE}/dashboard`)
  return handleResponse(response)
}

export async function getClasses() {
  const response = await fetch(`${API_BASE}/classes`)
  return handleResponse(response)
}

export async function getLessonsByClass(classId) {
  const response = await fetch(`${API_BASE}/lessons/class/${classId}`)
  return handleResponse(response)
}

export async function generateAssignmentBreakdown(assignment) {
  const response = await fetch(`${API_BASE}/assignment/breakdown`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(assignment),
  })

  return handleResponse(response)
}

export async function generateExamStudyPlan(exam) {
  const response = await fetch(`${API_BASE}/exam/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(exam),
  })

  return handleResponse(response)
}

export async function generateStudyModes(topic) {
  const response = await fetch(`${API_BASE}/study/modes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic }),
  })

  return handleResponse(response)
}

export async function recommendNextFocusTask(userProgress) {
  const response = await fetch(`${API_BASE}/focus/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(userProgress),
  })

  return handleResponse(response)
}

// ─── LessonForge ─────────────────────────────────────────────────────────────

export async function generateLessonPlan({ standard, gradeLevel, subject, description }) {
  const response = await fetch(`${API_BASE}/lessonforge/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ standard, gradeLevel, subject, description }),
  })
  return handleResponse(response)
}

export async function saveGeneratedLesson({ classId, className, title, standard, lesson }) {
  const response = await fetch(`${API_BASE}/lessonforge/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, className, title, standard, lesson }),
  })
  return handleResponse(response)
}

// ─── EduEquity ───────────────────────────────────────────────────────────────

export async function adaptContent(topic, profile) {
  const response = await fetch(`${API_BASE}/equity/adapt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, profile }),
  })
  return handleResponse(response)
}
