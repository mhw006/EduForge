const API_BASE = import.meta.env.VITE_API_BASE || '/api'

function demoHeaders(demoUser = 'teacher') {
  return { 'x-demo-user': demoUser }
}

async function apiFetch(path, { method = 'GET', body, demoUser = 'teacher', headers = {} } = {}) {
  return fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    headers: {
      ...demoHeaders(demoUser),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function handleResponse(response) {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || 'Request failed')
  }
  return response.json()
}

export async function getDashboardData() {
  try {
    const classResponse = await getClasses('teacher')
    const classes = classResponse.classes || []
    return {
      studentName: 'teacher',
      progress: {
        fuelPoints: 180 + classes.length * 20,
      },
      todayFocusTasks: [
        { id: 'review-lessons', title: 'Review generated lessons', done: classes.some((item) => item.lessonCount > 0) },
        { id: 'check-access', title: 'Check student accessibility profiles', done: false },
        { id: 'demo-student', title: 'Open the student adapted lesson view', done: false },
      ],
    }
  } catch {
    return {
      studentName: 'teacher',
      progress: { fuelPoints: 160 },
      todayFocusTasks: [
        { id: 'seed-data', title: 'Seed demo class and lesson data', done: true },
        { id: 'lessonforge', title: 'Generate or review one lesson', done: false },
        { id: 'student-demo', title: 'Verify student adaptation flow', done: false },
      ],
    }
  }
}

export async function getClasses(demoUser = 'teacher') {
  const response = await apiFetch('/classes', { demoUser })
  return handleResponse(response)
}

export async function getLessonsByClass(classId, demoUser = 'teacher') {
  const response = await apiFetch(`/lessons/class/${classId}`, { demoUser })
  return handleResponse(response)
}

export async function getLesson(lessonId, demoUser = 'student') {
  const response = await apiFetch(`/lessons/${lessonId}`, { demoUser })
  return handleResponse(response)
}

export async function getProfile(demoUser = 'student') {
  const response = await apiFetch('/profile', { demoUser })
  return handleResponse(response)
}

export async function updateProfile(updates, demoUser = 'student') {
  const response = await apiFetch('/profile', {
    method: 'PUT',
    body: updates,
    demoUser,
  })
  return handleResponse(response)
}

export async function getTranslationLanguages(demoUser = 'student') {
  const response = await apiFetch('/translate/languages', { demoUser })
  return handleResponse(response)
}

// recommendNextFocusTask: returns a static suggestion for the dashboard.
// The original /focus/recommend endpoint never existed; this avoids the round-trip + 404.
export async function recommendNextFocusTask() {
  return {
    recommendation: 'Demo the student adaptation loop: switch language, reading level, and bandwidth mode on the same lesson.',
    mode: 'EduEquity',
  }
}

// ─── LessonForge ─────────────────────────────────────────────────────────────

export async function generateLessonPlan({ standard, gradeLevel, subject, description }) {
  const response = await apiFetch('/lessonforge/generate', {
    method: 'POST',
    body: { standard, gradeLevel, subject, description },
  })
  return handleResponse(response)
}

export async function saveGeneratedLesson({ classId, className, title, standard, lesson }) {
  const response = await apiFetch('/lessonforge/save', {
    method: 'POST',
    body: { classId, className, title, standard, lesson },
  })
  return handleResponse(response)
}

// ─── EduEquity ───────────────────────────────────────────────────────────────

export async function adaptContent(topic, profile) {
  const response = await apiFetch('/equity/adapt', {
    method: 'POST',
    body: { topic, profile },
  })
  return handleResponse(response)
}

// ─── Phase 2: Standards search (RAG corpus) ──────────────────────────────────
export async function searchStandards(query, limit = 8) {
  const params = new URLSearchParams()
  if (query) params.set('q', query)
  params.set('limit', String(limit))
  const response = await apiFetch(`/standards/search?${params}`)
  return handleResponse(response)
}

// ─── Phase 1: Teacher Feedback Loop ──────────────────────────────────────────
// Fire-and-forget: failures must never block the teacher's save flow.
export async function logLessonEdit({ lessonId, level, section, editType, aiVersion, humanVersion = null }) {
  try {
    const response = await apiFetch(`/edits/${lessonId}`, {
      method: 'POST',
      demoUser: 'teacher',
      body: { level, section, editType, aiVersion, humanVersion },
    })
    if (!response.ok) return null
    return response.json()
  } catch {
    return null
  }
}

export async function getEditSummary({ classId, lessonId } = {}) {
  const params = new URLSearchParams()
  if (classId) params.set('classId', classId)
  if (lessonId) params.set('lessonId', lessonId)
  const response = await apiFetch(`/edits/summary?${params}`, { demoUser: 'teacher' })
  return handleResponse(response)
}

// ─── Phase 3: Engagement Telemetry ───────────────────────────────────────────
// Used by StudentView to log toggle events. Fire-and-forget — student UX never
// blocks on telemetry.
export async function logEngagementEvent({ lessonId, eventType, metadata = {} }) {
  try {
    await apiFetch('/analytics/event', {
      method: 'POST',
      demoUser: 'student',
      body: { lessonId, eventType, metadata },
    })
  } catch { /* ignore */ }
}
