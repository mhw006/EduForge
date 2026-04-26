# EduForge - LA Hacks 2026 (Light the Way Presented by Aramco)

EduForge is an AI-assisted lesson generation and student adaptation platform for teachers and learners. Teachers can generate differentiated lessons from curriculum standards, publish them to classes, review classroom signals, and track how AI output is accepted or revised. Students receive adapted lesson experiences with reading-level support, translation, accessibility controls, diagnostics, quizzes, study modes, and progress-oriented learning views.

## Team

- Maddox Wong: Project Manager / DevOps
- Mason Soldano: Full-Stack / Integration Engineer
- Matthew Chen: Database & Backend Engineer
- Ed Trejo: Frontend Engineer

## Core Features

- LessonForge generation: creates three differentiated lesson tiers: foundational, grade level, and advanced.
- Standards grounding: references a curated standards corpus before generating lessons.
- Teacher workflow: class management, lesson generation, save/publish, PDF export, analytics, and AI-vs-teacher edit logging.
- Student workflow: published lessons, learner profile controls, diagnostics, reading-level adaptation, translation, bandwidth mode, TTS, high contrast, and dyslexia-friendly display.
- Student learning modes: interactive lesson, flashcards, fill-in-the-blank, quiz mode, visual explanation, practice problems, and daily focus plan.
- Analytics loop: engagement events, quiz attempts, diagnostics, classroom recommendations, and teacher feedback summaries.

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

- Anthropic Claude API: lesson generation and AI-assisted adaptation.
- DeepL API: lesson and text translation.
- ElevenLabs API: optional generated TTS audio.
- Web Speech API: browser-based TTS fallback.
- Clerk: authentication integration.
- Supabase PostgreSQL: primary database.
- AWS S3 SDK: audio/object storage integration.

## Project Structure

```text
EduForge/
  client/          React/Vite frontend
  server/          Express API, Prisma schema, scripts, services
  DEMO_PREP.md     Demo runbook and fallback steps
  README.md        Project overview and setup
```

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

## API Overview

Main backend route groups:

- `/api/lessonforge`: generate and save AI lessons.
- `/api/lessons`: create, update, stream, publish, unpublish, list, and fetch lessons.
- `/api/classes`: create classes, join classes, list classes, and manage class membership.
- `/api/profile`: get and update learner profiles.
- `/api/diagnostics`: diagnostic catalogs, questions, submissions, summaries, and lesson checks.
- `/api/analytics`: engagement events, class analytics, loop status, and recommendations.
- `/api/quiz`: quiz submissions and attempts.
- `/api/translate`: translation languages and direct translation.
- `/api/adapt`: adapted lesson retrieval and audio generation.
- `/api/equity`: teacher-only AI adaptation endpoint.
- `/api/export`: PDF export.
- `/api/edits`: teacher feedback/edit logging.
- `/api/standards`: standards search and lookup.
- `/api/chat`: tutor/session support.

## Database and Scripts

From `server/`:

```bash
npm run generate
npm run migrate
npm run seed
npm run smoke
npm run backups
```

Useful scripts:

- `npm run generate`: generate Prisma client.
- `npm run migrate`: run Prisma migrations locally.
- `npm run seed`: seed demo teacher, student, class, and lessons.
- `npm run smoke`: run backend smoke tests.
- `npm run backups`: generate or restore backup demo lessons.

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

## Deployment Notes

EduForge is split into a static frontend and an API backend.

- Deploy `client/` as a Vite static app.
- Deploy `server/` as a Node.js service.
- Provision Supabase PostgreSQL and run Prisma migrations.
- Configure Clerk keys for real authentication.
- Configure Anthropic, DeepL, and optional ElevenLabs credentials.
- Set `FRONTEND_URL` on the server to the deployed frontend origin.
- Keep `ALLOW_DEMO_AUTH` disabled in staging and production unless intentionally running a locked-down demo environment.

## Security Notes

- Lesson generation and AI adaptation endpoints are teacher-protected.
- Student lesson access is limited to published lessons in enrolled classes.
- Demo auth is opt-in through `ALLOW_DEMO_AUTH=true`.
- Translation cache is invalidated when lesson content changes.
