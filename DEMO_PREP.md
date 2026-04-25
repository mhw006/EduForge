# EduForge Demo Prep

**Track:** Light the Way (LA Hacks 2026)
**Time:** 4 minutes
**Tagline:** *Every Standard. Every Learner. Every Bandwidth.*

---

## ✅ Pre-Flight Checklist (run T-5 minutes)

Run these in order. If any step fails, jump straight to the [Oh Sh\*t Protocol](#-oh-sht-protocol).

### 1. Environment health (60 seconds)

```bash
cd ~/Desktop/EduForge

# Verify backend env keys are real (no placeholders)
grep -E "ANTHROPIC_API_KEY|CLERK_SECRET_KEY" server/.env | grep -v '"sk-ant-\.\.\."' | grep -v '"sk_\.\.\."' | wc -l
# Expected: 2  (both keys filled in)

# Verify backups exist in DB
cd server && PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH" npm run smoke 2>&1 | tail -3
# Expected: "27 passed, 0 failed"
```

### 2. Boot servers (two terminal tabs)

**Tab A — backend:**
```bash
cd ~/Desktop/EduForge/server && npm run dev
```
Wait for: `Server running on http://localhost:3001`

**Tab B — frontend:**
```bash
cd ~/Desktop/EduForge/client && npm run dev
```
Wait for: `Local: http://localhost:5173`

### 3. Browser tabs (in this exact order, left → right)

| # | Tab | URL | Purpose |
|---|---|---|---|
| 1 | **Teacher view** | `http://localhost:5173/teacher` (or `/dashboard` if route differs) | Pasting standard, watching SSE stream |
| 2 | **Student view** | `http://localhost:5173/student` (open in incognito so Clerk session is separate) | Showing adapted lesson |
| 3 | **Backup-ready URL** | `http://localhost:5173/lessons/demo_lesson_001` | Pre-loaded "Citing Textual Evidence" — the safety net |
| 4 | **Health check** | `http://localhost:3001/api/health` | Proves backend is live |
| 5 | **Slide deck / pitch** | (your slides) | Hook & close |
| 6 | **Spec doc** | `~/Downloads/eduforge_spec.docx` (in case judges ask) | Reference |

### 4. Pre-log-in (Clerk dev keys are filled in)

- **Tab 1 (Teacher):** sign in as `teacher@demo.com`. *Note: with Clerk in dev mode, you may get an email magic link — confirm BEFORE the demo starts so you're not waiting on inbox.*
- **Tab 2 (Student):** sign in as `student@demo.com` (separate browser window or incognito). Profile is preset to **FOUNDATIONAL / Spanish / TEXT_ONLY / dyslexia font / large / TTS-on**.

### 5. Pre-stage demo content (so judges don't see empty UI)

- Confirm the teacher view shows the "6th Grade ELA — Period 3" class with **3 lessons** visible:
  1. Citing Textual Evidence (`demo_lesson_001`) — the seed lesson
  2. The Water Cycle (`backup_lesson_water_cycle`) — Claude-generated
  3. The Industrial Revolution (`backup_lesson_industrial_revolution`) — Claude-generated

If you see fewer than 3, run `cd server && npm run seed && npm run backups` to repopulate.

### 6. Network reality check

- Open Chrome DevTools → Network tab → set throttling to **Fast 3G**. Leaving it on the Student tab makes the bandwidth-stripping demo natural ("look how it loads even on a slow connection").
- Don't actually demo on hotel wifi — tether to your phone if the venue WiFi is sketchy.

### 7. Have these copy-paste-ready in a scratch buffer

```
CCSS.ELA-LITERACY.RI.6.1
NGSS MS-ESS2-4
C3 D2.His.1.9-12
DEMO2024
```

---

## 🎬 The Demo Script (4 minutes)

> **Tone:** confident, fast, two-presenter pacing. One person drives the keyboard, the other narrates.

### 0:00 – 0:30 — Hook (slide)

> *"Over 300 million students globally are locked out of quality education — not because the content doesn't exist, but because it doesn't reach them in a form they can actually use. Their first language isn't English. They have dyslexia. They're on 2G. Teachers spend 7 to 12 hours a week trying to bridge that gap by hand. We built EduForge to close it automatically."*

### 0:30 – 1:30 — Teacher Flow: live lesson generation

**Switch to Tab 1 (Teacher).**

> *"This is the teacher view. I'm a 6th grade ELA teacher. I have a Common Core standard I need to teach…"*

**Action:** Paste `CCSS.ELA-LITERACY.RI.6.1` into the standard input field. Click **Generate**.

> *"What's happening right now: our backend is calling Claude Opus 4.7 with a structured prompt asking for **three** differentiated lesson plans — one at Lexile 400-600 for struggling readers, one at grade level, one for advanced learners. Each with vocabulary, content, activities, and a five-question quiz."*

**Wait ~30-60 sec.** As text streams in via SSE, narrate:

> *"This is streaming live via Server-Sent Events. No mocks. Three separate lesson plans, generated specifically for this standard, in real time."*

**When complete, scroll through the three tabs (Foundational / Grade Level / Advanced).**

> *"This would normally take a teacher 2-3 hours. We did it in under a minute."*

### 1:30 – 2:30 — Student Flow: real-time adaptation

**Switch to Tab 2 (Student, incognito).**

> *"Now switch hats. This same lesson, from the perspective of one of that teacher's students."*

**Action:** Click the just-generated lesson, OR navigate to the pre-loaded `Citing Textual Evidence` lesson.

> *"This student speaks Spanish at home. Has dyslexia. Reads two grades below level. Watch what happens."*

**Action:** Open the Adaptation Settings panel.

- Toggle **Reading level → Foundational** → text simplifies
- Toggle **Language → Español** → DeepL re-renders content in Spanish
- Toggle **Font → Dyslexia-friendly** → switches to OpenDyslexic font
- Click **🔊 Read aloud** → ElevenLabs/Web Speech reads the passage

> *"None of this is a separate version. The teacher wrote ONE lesson. EduEquity is doing the rest at request time."*

### 2:30 – 3:00 — Bandwidth-aware delivery

> *"What about the student in a rural school on 2G?"*

**Action:** Toggle **Bandwidth → Text Only**. Images strip. Activities that say "watch the video" disappear.

> *"Same content. Zero broken images. Zero blank space. Functional on a connection that would crush most ed-tech."*

### 3:00 – 3:30 — Teacher Analytics (if dashboard is wired up; skip if not)

**Switch to Tab 1 (Teacher).** Click Analytics.

> *"And the teacher sees aggregate engagement across the class — which reading level is most selected, where students are getting stuck — without entering a single piece of data manually."*

*(If analytics isn't wired up, skip and use the extra 30s to expand the close.)*

### 3:30 – 4:00 — Close

> *"EduForge. The AI does the work that takes teachers hours. The adaptation layer makes that work reach every student — every language, every reading level, every device, every connection."*
>
> *"It's at \[YOUR_VERCEL_URL\]. Judges, please try it. Use class code **DEMO2024**."*

---

## 🚨 Oh Sh\*t Protocol (Backup Plan)

Three failure modes, three fallbacks. Each one is invisible to judges if you stay calm.

### Tier 1: Live generation is slow / streams visibly stalls

**Symptom:** SSE chunks stop arriving for >10s, or generation passes 90s.

**What to say:** *"Let me show you a lesson that finished generating earlier — this is live data from the same engine, same model, just persisted."*

**What to do:** Click on the **"Citing Textual Evidence"** lesson in the teacher's lesson list. It's pre-seeded as `READY` — opens instantly. Continue the demo from the Student Flow as if you'd just generated it.

### Tier 2: Anthropic API down OR your key gets rate-limited

**Symptom:** Generate button returns 5xx error, or the stream errors out immediately.

**What to say:** *"Our backend caches every generated lesson — let me pull up two we already have."*

**What to do:** Show the **two backup lessons**, both real Claude Opus 4.7 output cached locally:

| Click here | Lesson | Subject Standard |
|---|---|---|
| `backup_lesson_water_cycle` | The Water Cycle: How Water Moves Through Earth's Systems | NGSS MS-ESS2-4 (Grade 6 Science) |
| `backup_lesson_industrial_revolution` | The Industrial Revolution: How Time and Place Changed the World (1760–1840) | C3 D2.His.1.9-12 (Grade 10 History) |

The Student Flow / EduEquity adaptation works exactly the same on these. **Pivot the narrative:** instead of "watch it generate," say *"these are two lessons our system has already produced — one science, one history, generated by the same engine."* Then continue with the student adaptation.

### Tier 3: The frontend itself crashes / won't load

**Symptom:** White screen, vite dev server died, deployed Vercel returns 500.

**What to say:** *"We're running directly against the API. Watch what the backend returns."*

**What to do:** Switch to **Tab 4 (Health Check)** to prove backend is alive, then run these in a terminal that's pre-sized large enough for judges to read:

```bash
# 1. Show the seeded lesson
curl -s http://localhost:3001/api/lessons/demo_lesson_001 | jq .title
# → "Citing Textual Evidence"

# 2. Show adaptation working — student gets Foundational/Spanish/TEXT_ONLY view
curl -s -H "x-demo-user: student" \
  http://localhost:3001/api/adapt/demo_lesson_001 | jq '.appliedProfile, .content._a11y'
```

Narrate: *"appliedProfile shows Foundational reading level, Spanish, text-only bandwidth — exactly what this student's profile demands. The whole adaptation pipeline ran in under a second."*

This is your absolute floor — backend can demo without a UI at all.

### Tier 4 (last resort): Network goes down entirely

Open `server/prisma/backup-lessons.json` in your editor. It's the raw cached Claude output, formatted JSON. Walk through the structure live:

> *"This is real Claude output that we cached for resilience. Three reading levels, vocabulary tied to the content, five-question quizzes. Even with no network, the content exists."*

---

## 📋 Quick Reference

### Demo accounts

| Account | Email | ID | Role |
|---|---|---|---|
| Teacher | `teacher@demo.com` | `demo_teacher_001` | TEACHER |
| Student | `student@demo.com` | `demo_student_001` | STUDENT |

Student profile pre-set: **FOUNDATIONAL / es / TEXT_ONLY / dyslexia font / LARGE / TTS-on**

### Demo class

| Field | Value |
|---|---|
| Name | 6th Grade ELA — Period 3 |
| Join code | `DEMO2024` |

### Pre-loaded lessons (all `status: READY`)

| ID | Title | Standard |
|---|---|---|
| `demo_lesson_001` | Citing Textual Evidence | CCSS.ELA-LITERACY.RI.6.1 |
| `backup_lesson_water_cycle` | The Water Cycle | NGSS MS-ESS2-4 |
| `backup_lesson_industrial_revolution` | The Industrial Revolution | C3 D2.His.1.9-12 |

### Endpoints (localhost)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Liveness check |
| POST | `/api/lessons` | Teacher kicks off generation |
| GET | `/api/lessons/:id/stream` | SSE stream of Claude output |
| GET | `/api/lessons/:id` | Fetch a completed lesson |
| GET | `/api/adapt/:id` | Student gets adapted content |
| POST | `/api/adapt/:id/audio` | TTS |
| GET | `/api/profile` | Get student's accessibility profile |
| PUT | `/api/profile` | Update accessibility profile |
| GET | `/api/classes` | Teacher's classes / student's enrollments |
| POST | `/api/classes/join` | Student joins via code |

### Recovery commands (if something breaks pre-demo)

```bash
# Re-seed the database (idempotent — safe to run anytime)
cd ~/Desktop/EduForge/server && npm run seed

# Re-load backup lessons (uses cached JSON, no API call)
npm run backups

# Verify entire backend is healthy
npm run smoke
# Expected: "27 passed, 0 failed"

# Restart backend
npm run dev

# Restart frontend
cd ../client && npm run dev
```

---

## 👥 Roles during the demo

| Person | Job |
|---|---|
| **Driver** | Hands on keyboard, follows script. Does NOT narrate while clicking. |
| **Narrator** | Speaks the script. Watches the screen and stays one beat ahead of the driver. |
| **Backup operator** | Has terminal open, ready to switch tabs / run curl / re-seed if needed. Stays silent unless invoked. |
| **Pitch closer** | Handles the close + Q&A. Knows the spec doc cold. |

---

*Last updated: pre-demo. Don't edit during the demo window.*
