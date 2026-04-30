# EduForge - LA Hacks 2026 (Light the Way Presented by Aramco)

EduForge is an AI-powered lesson generation and student adaptation platform that closes a full learning data flywheel — from curriculum standard to differentiated lesson, real-time student adaptation, engagement tracking, diagnostic placement, and AI-ranked teacher recommendations. Every interaction feeds back into smarter generation and more equitable delivery.

## Team

- Maddox Wong: Project Manager / DevOps
- Mason Soldano: Full-Stack / Integration Engineer
- Matthew Chen: Database & Backend Engineer
- Ed Trejo: Frontend Engineer

---

## Core Features

### LessonForge — Differentiated AI Lesson Generation

- Generates three lesson tiers in a single call: **Foundational** (400L–600L Lexile), **Grade Level** (700L–900L), and **Advanced** (1000L–1200L), each with title, overview, vocabulary, main content, activities, and a quiz.
- Grounded in a curated standards corpus (Common Core, state standards, IB) — lessons are anchored to recognized curriculum frameworks before generation begins.
- Generation cache with 6-hour TTL and in-flight deduplication: concurrent requests for the same standard share one generation call.
- Streaming delivery via Server-Sent Events — teachers see output as it generates.

### Data Flywheel — Edit Telemetry & AI Feedback Loop

Every teacher interaction with AI output is logged at the section level to identify where the AI falls short:

- Per-section **Accept / Modify / Reject** buttons across all three tiers (Title, Overview, Main Content, Vocabulary, Activities, Quiz).
- Each action logs: original AI version, human-edited version, character delta, tier, and section — producing a structured record of AI vs. human decisions.
- Aggregated **edit hotspot detection**: the dashboard surfaces which sections teachers rewrite most across the class, closing the loop directly back to generation quality.
- Edit types tracked: `ACCEPTED_AS_IS`, `MODIFIED`, `REJECTED`, `REGENERATED`.

### Recommendation Engine — AI-Ranked Teacher Intelligence

Claude analyzes live class signals after every session and returns ranked, prioritized next actions for the teacher:

- Flags tiers with quiz scores below 70%.
- Identifies the most-rewritten lesson section (AI weakness hotspot).
- Detects which accessibility needs are actively used in the class (language toggles, TTS activations, bandwidth changes).
- Recommends more scaffolding if 50%+ of the class is at the Foundational tier.
- Returns up to 3 actionable, Claude-generated recommendations per class, surfaced directly on the dashboard.

### Real-Time Student Adaptation Layer

Published lessons are adapted on delivery to each student's learner profile:

- **Reading tier selection**: Foundational, Grade Level, or Advanced content delivered based on the student's current level.
- **12-language translation** via DeepL: English, Spanish, French, Chinese, Arabic, Portuguese, German, Japanese, Korean, Hindi, Vietnamese, Tagalog — cached per lesson/tier/language and invalidated on lesson edits.
- **Bandwidth mode**: Full, Reduced, or Text-Only — images and video activities are stripped server-side (not just hidden) for low-connectivity environments. The browser's Network Information API detects slow connections and suggests Text-Only mode automatically.
- **Accessibility transforms**: dyslexia-friendly font, high contrast, screen reader mode (aria-live, verbal descriptions, numbered lists), reduced motion, and font size (Small / Medium / Large / XLarge).
- All adaptation is applied at the API layer — the student always receives content matched to their profile.

### Diagnostics & Placement

- **Placement tests** across three domains: Reading, Math, and Science — 13 questions each, scored to infer level (< 40% = Foundational/Below Grade, 40–79% = Grade Level, ≥ 80% = Advanced).
- **Lesson-embedded quick diagnostics**: a short diagnostic inside a lesson scores the student on the spot, infers a new level if the result changes, triggers real-time content re-adaptation, and shows a banner explaining exactly why the level shifted (Claude-generated adaptation reason).
- Diagnostic history persisted per student: domain, score, inferred level, responses, and recommended profile patch.

### Student Learning Modes — 7 Interactive Study Formats

Every published lesson is available in seven modes, selectable by the student:

1. **Interactive Lesson** — numbered sections with progress bar and Previous/Next navigation.
2. **Flashcards** — flip-to-reveal vocabulary term ↔ definition cards.
3. **Fill-in-the-Blank (Cloze)** — auto-generated cloze items from vocabulary and main content; hints shown on request.
4. **Quiz Mode** — multi-choice A/B/C/D quiz with immediate feedback, explanation, and score tracking.
5. **Visual Explanation** — node-based concept map: primary idea as root, vocabulary as branches, activities as visual steps.
6. **Practice Problems** — 3 problems derived from vocabulary, activities, and quiz explanations with reveal-on-demand answers.
7. **Daily Focus Plan** — structured 3-step plan (Read → Practice → Quiz yourself) auto-generated from lesson content.

### AI Tutoring with Knowledge State Tracking

The tutoring chat is a two-stage AI pipeline, not a simple Q&A bot:

- **Stage 1**: Claude generates an equity-aware tutoring reply adapted to the student's reading level, language, and accessibility profile.
- **Stage 2**: A second Claude call extracts structured knowledge state JSON from the exchange — per-concept mastery scores (0.0–1.0), identified struggle area, difficulty adjustment (increase/decrease/maintain), and suggested next concept.
- Session memory: last 10 messages, user profile, and knowledge state persist across the session.
- Dynamic difficulty: concept scores shift ±0.15 per exchange based on demonstrated understanding.

### Bonfire Progress System — Non-Punitive Gamification

A momentum tracker designed to encourage return rather than punish absence:

- **Fuel Points** earned per completed task or study session.
- **Focus Level tiers**: High Growth Momentum (> 300 pts) → On Track (220–300) → Needs Reinforcement (120–220) → Intervention Recommended (< 120).
- Missed days apply a minimal decay (max 8 points deducted) — the system never resets progress punitively.
- BonfireWidget visible on both student and teacher dashboards; class-level momentum visible to teachers.

### The Anvil — Teacher Adaptation Preview Studio

A teacher-only tool to preview exactly what any student profile experiences before publishing:

- Input: topic + full learner profile (reading level, language, bandwidth mode, accessibility flags).
- Output: real-time adapted content with accessibility metadata showing which transforms were applied.
- Lets teachers see what Foundational + Spanish + Dyslexia Font looks like before a single student opens the lesson.

### Class Management & Roster Intelligence

- Class creation with auto-generated join codes and shareable invite links.
- Student enrollment, class leave, and teacher-controlled roster management.
- **Diagnostic summary table** per class: reading, math, and science levels + scores for every student, inline.
- **Teacher-level override**: manually set a student's reading or math tier regardless of what the diagnostic inferred — for cases where teacher judgment supersedes the algorithm.
- Class analytics: reading level distribution, math level distribution, per-lesson engagement, quiz completion rates, and edit section summaries.

### Engagement Tracking

Lightweight, fire-and-forget event logging that never interrupts the student experience:

- Events tracked: `VIEW`, `QUIZ_START`, `QUIZ_COMPLETE`, `LANGUAGE_TOGGLE`, `TTS_TOGGLE`, `BANDWIDTH_CHANGE`, `EXPORT_PDF`.
- All events feed the recommendation engine and class analytics dashboard.
- Returns 204 silently even on error — student UX is never blocked.

### Study Planner & Daily Focus Calendar

- Auto-generated 7–14 day calendar with daily Read/Practice tasks derived from published lessons.
- Students mark days complete; "Today" badge highlights the current day.
- Study Planner view shows upcoming assignments as a checklist with completion status.

### PDF Export

- One-click export of any lesson to PDF (all three tiers) via PDFKit, triggered from the LessonForge editor.

### Help & Glossary

- Built-in documentation tab with 20 Q&A pairs covering every metric, tool, and feature in the platform.
- Expandable accordion UI organized into three sections: Student Levels & Diagnostics, Dashboard Metrics, Tools & Features.

---

## Tech Stack

### Frontend

- React 19
- Vite 6
- React Router
- Recharts
- CSS with shared custom properties in `client/src/index.css`

### Backend

- Node.js
- Express 5
- Prisma ORM
- PostgreSQL via Supabase
- Server-Sent Events for lesson generation streaming
- PDFKit for PDF export
- Express rate limiting

### AI, API, and External Services

- **Anthropic Claude API**: lesson generation, real-time content adaptation, AI tutoring (two-stage knowledge extraction pipeline), and recommendation engine.
- **DeepL API**: lesson and text translation across 12 languages, with per-lesson translation cache.
- **ElevenLabs API**: premium generated TTS audio with S3-backed audio cache.
- **Web Speech API**: browser-based TTS fallback.
- **Clerk**: authentication and role-based access control (Teacher, Student, Admin).
- **Supabase PostgreSQL**: primary database via Prisma ORM.
- **AWS S3 SDK**: audio and object storage for TTS cache.

---

## Project Structure

```text
EduForge/
  client/          React/Vite frontend
  server/          Express API, Prisma schema, scripts, services
  DEMO_PREP.md     Demo runbook and fallback steps
  README.md        Project overview and setup
```

---

## Local Setup

Install dependencies from the repo root:

```bash
npm install
npm install --prefix client
npm install --prefix server
```

Create environment files from the examples:

```bash
cp client/.env.example client/.env
cp server/.env.example server/.env
```

For local demo mode, set this in `server/.env`:

```env
ALLOW_DEMO_AUTH=true
```

Leave `ALLOW_DEMO_AUTH=false` or unset for staging and production.

Run the full app:

```bash
npm run dev
```

Run only one side:

```bash
npm run dev:client
npm run dev:server
```

Default local URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`

---

## Environment Variables

### Client

- `VITE_API_URL`: backend API URL.
- `VITE_WS_URL`: websocket/SSE-related server URL.
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk frontend key.
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/publishable key.

### Server

- `DATABASE_URL`: pooled PostgreSQL connection string.
- `DIRECT_URL`: direct PostgreSQL connection string.
- `ANTHROPIC_API_KEY`: Anthropic API key.
- `DEEPL_API_KEY`: DeepL API key.
- `ELEVENLABS_API_KEY`: ElevenLabs API key.
- `ELEVENLABS_VOICE_ID`: ElevenLabs voice ID.
- `CLERK_SECRET_KEY`: Clerk backend secret.
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key.
- `PORT`: backend port, usually `3001`.
- `NODE_ENV`: runtime environment.
- `FRONTEND_URL`: allowed frontend origin for CORS.
- `ALLOW_DEMO_AUTH`: enables local demo-user bypass when set to `true`.

---

## API Overview

Main backend route groups:

- `/api/lessonforge`: generate and save AI lessons.
- `/api/lessons`: create, update, stream, publish, unpublish, list, and fetch lessons.
- `/api/classes`: create classes, join classes, list classes, manage class membership, and roster diagnostics.
- `/api/profile`: get and update learner profiles.
- `/api/diagnostics`: diagnostic catalogs, placement tests (reading/math/science), lesson-embedded diagnostics, submissions, and summaries.
- `/api/analytics`: engagement events, class analytics, edit hotspot summaries, loop status, and Claude-generated recommendations.
- `/api/quiz`: quiz submissions and attempts.
- `/api/translate`: supported languages and direct translation.
- `/api/adapt`: adapted lesson retrieval, bandwidth stripping, and TTS audio generation.
- `/api/equity`: teacher-only Anvil adaptation preview endpoint.
- `/api/export`: PDF export.
- `/api/edits`: per-section teacher feedback and edit telemetry logging.
- `/api/standards`: standards corpus search and lookup.
- `/api/chat`: two-stage AI tutoring with knowledge state tracking.

---

## Database and Scripts

From `server/`:

```bash
npm run generate
npm run migrate
npm run seed
npm run smoke
npm run backups
```

- `npm run generate`: generate Prisma client.
- `npm run migrate`: run Prisma migrations locally.
- `npm run seed`: seed demo teacher, student, class, and lessons.
- `npm run smoke`: run backend smoke tests.
- `npm run backups`: generate or restore backup demo lessons.

---

## Build and Verification

Frontend production build:

```bash
npm run build
```

Backend smoke test:

```bash
cd server
npm run smoke
```

---

## Deployment Notes

EduForge is split into a static frontend and an API backend.

- Deploy `client/` as a Vite static app.
- Deploy `server/` as a Node.js service.
- Provision Supabase PostgreSQL and run Prisma migrations.
- Configure Clerk keys for real authentication.
- Configure Anthropic, DeepL, and optional ElevenLabs credentials.
- Set `FRONTEND_URL` on the server to the deployed frontend origin.
- Keep `ALLOW_DEMO_AUTH` disabled in staging and production unless intentionally running a locked-down demo environment.

---

## Security Notes

- Lesson generation and AI adaptation endpoints are teacher-protected.
- Student lesson access is limited to published lessons in enrolled classes.
- Teacher-level student overrides are class-scoped and teacher-only.
- Demo auth is opt-in through `ALLOW_DEMO_AUTH=true`.
- Translation and audio caches are invalidated when lesson content changes.
