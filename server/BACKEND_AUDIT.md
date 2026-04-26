# Backend Audit

Date: 2026-04-25
Branch: `codex/backend-audit`

## Verification Baseline

- `npm run smoke`: passed (`30 passed, 0 failed`)
- `npm run generate`: passed

## Recently Fixed And Re-Verified

### Translation fallback looked like accent-only TTS instead of real text translation

- Status: fixed on parent branch and present in this audit branch
- Files:
  - `server/src/services/deepl.js`
- Notes:
  - Lesson translation now batches the entire lesson payload into one DeepL request instead of many parallel field-level requests.
  - This prevents the `429` rate limiting pattern that caused English fallback content while Web Speech still switched voices.

### Students could see unpublished draft lessons

- Status: fixed on parent branch and present in this audit branch
- Files:
  - `server/src/routes/lessons.js:85`
  - `server/src/routes/lessons.js:115`
  - `server/src/routes/lessons.js:206`
  - `server/prisma/schema.prisma:66`
- Notes:
  - Schema still includes `publishedAt` and `publishedById`.
  - Student lesson lists are now filtered to `READY` lessons with `publishedAt != null`.
  - Publish and unpublish endpoints are restored.

## Open Findings

### P1: Lesson generation endpoint is unauthenticated and can burn API credits

- File: `server/src/routes/lessonforge.js:10`
- Risk:
  - `POST /api/lessonforge/generate` calls Anthropic-backed generation without `requireTeacher` or `requireAuth`.
  - Any caller who can reach the backend can generate lessons and consume paid model usage.
- Why this matters:
  - Existing global rate limiting reduces abuse volume but does not prevent unauthorized use.
  - The matching save path at `server/src/routes/lessonforge.js:36` is teacher-protected, so generation and persistence currently have inconsistent trust boundaries.
- Recommended fix:
  - Require teacher auth on `/generate`.
  - Optionally log caller identity and class context for cost attribution.

### P1: Translation cache can serve stale content after lesson edits

- Files:
  - `server/src/services/deepl.js:136`
  - `server/src/services/deepl.js:150`
  - `server/prisma/schema.prisma:246`
- Risk:
  - `TranslationCache` is keyed only by `(lessonId, level, targetLang)`.
  - Editing a lesson after translation does not invalidate or version cached translated content.
- Why this matters:
  - Students can keep seeing outdated translated lessons even after a teacher updates the English source.
  - Smoke tests will not catch this because they do not exercise update-then-translate cache freshness.
- Recommended fix:
  - Include a cache version signal such as `lesson.updatedAt`, a content hash, or a publish version in the cache key.
  - Or delete translation cache rows when lesson content changes.

### P2: Class join endpoint is not idempotent

- File: `server/src/routes/classes.js:40`
- Risk:
  - `POST /api/classes/join` returns `409` when a student is already enrolled.
  - Repeating the same join request is treated as an error instead of a no-op success.
- Why this matters:
  - Retrying from the UI or mobile networks can create noisy failures for a state that is already correct.
  - This is more of a product/API contract issue than a data-integrity issue.
- Recommended fix:
  - Return `200` with the existing enrollment/class payload when the student is already enrolled.

### P2: Demo auth fallback is broad outside production

- File: `server/src/middleware/auth.js:13`
- Risk:
  - Demo auth is allowed whenever `NODE_ENV !== 'production'` or test Clerk keys are present.
  - Requests without real auth can silently resolve to demo teacher or student users.
- Why this matters:
  - This is acceptable for local demo workflows, but risky if a staging environment is not locked down carefully.
  - The fallback currently favors convenience over explicit opt-in.
- Recommended fix:
  - Gate demo auth behind an explicit env flag such as `ALLOW_DEMO_AUTH=true`.
  - Default to rejecting unauthenticated requests even in non-production unless that flag is set.

## Suggested Order Of Fixes

1. Protect `POST /api/lessonforge/generate` with teacher auth.
2. Add translation cache invalidation or versioning.
3. Make class join idempotent.
4. Tighten demo-auth gating before any staging or public deployment.
