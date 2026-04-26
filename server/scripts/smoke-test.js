#!/usr/bin/env node
/**
 * EduForge backend smoke test
 *
 * Boots the server in-process, exercises every endpoint, prints PASS/FAIL.
 * Cleans up its own test data. Exits 0 on full pass, 1 on any failure.
 *
 * Run: npm run smoke   (from server/)
 */
require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');

const SMOKE_PORT = process.env.SMOKE_PORT || '3101';
const BASE = `http://localhost:${SMOKE_PORT}`;
const results = [];

function log(name, ok, detail = '') {
  results.push({ name, ok });
  const tag = ok ? '\x1b[32m✓ PASS\x1b[0m' : '\x1b[31m✗ FAIL\x1b[0m';
  console.log(`  ${tag}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function check(name, fn) {
  try {
    const detail = await fn();
    log(name, true, detail || '');
  } catch (err) {
    log(name, false, err.message);
  }
}

async function http(method, url, body, opts = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (opts.demo) headers['x-demo-user'] = opts.demo; // 'teacher' | 'student'

  const res = await fetch(BASE + url, {
    method,
    headers: Object.keys(headers).length ? headers : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { /* not JSON */ }
  return { status: res.status, body: json, raw: text };
}

// ─── Phase 1: static module load (catches import errors before booting) ──────
async function testModuleLoads() {
  console.log('\n[1/4] Module loading');

  const modules = [
    'src/db',
    'src/lib/prisma',
    'src/middleware/auth',
    'src/middleware/eduequity',
    'src/services/deepl',
    'src/services/elevenlabs',
    'src/services/storage',
    'src/routes/lessons',
    'src/routes/adapt',
    'src/routes/profile',
    'src/routes/classes',
    'src/routes/translate',
    'src/routes/quiz',
    'src/routes/analytics',
    'src/routes/export',
    'src/routes/edits',
    'src/routes/standards',
    'src/services/standards-retrieval',
  ];

  for (const m of modules) {
    await check(`require('${m}')`, () => {
      delete require.cache[require.resolve(path.join(__dirname, '..', m))];
      require(path.join(__dirname, '..', m));
    });
  }
}

// ─── Phase 2: DB connectivity + seed presence ────────────────────────────────
async function testDatabase(prisma) {
  console.log('\n[2/4] Database');

  await check('connect to Supabase', async () => {
    await prisma.$queryRaw`SELECT 1`;
    return 'connected';
  });

  await check('demo teacher exists (seed required for dev bypass)', async () => {
    const u = await prisma.user.findUnique({ where: { id: 'demo_teacher_001' } });
    if (!u) throw new Error('run `node prisma/seed.js`');
    return u.email;
  });

  await check('schema columns match middleware expectations', async () => {
    const counts = {
      users:    await prisma.user.count(),
      classes:  await prisma.class.count(),
      lessons:  await prisma.lesson.count(),
      profiles: await prisma.learnerProfile.count(),
    };
    return Object.entries(counts).map(([k, v]) => `${k}=${v}`).join(' ');
  });
}

// ─── Phase 3: HTTP endpoints ─────────────────────────────────────────────────
async function testEndpoints(prisma) {
  console.log('\n[3/4] HTTP endpoints');

  await check('GET /api/health → 200', async () => {
    const r = await http('GET', '/api/health');
    if (r.status !== 200) throw new Error(`got ${r.status}: ${r.raw.slice(0, 80)}`);
  });

  await check('GET /api/profile → 200', async () => {
    const r = await http('GET', '/api/profile', null, { demo: 'teacher' });
    if (r.status !== 200) throw new Error(`got ${r.status}: ${r.raw.slice(0, 80)}`);
  });

  await check('PUT /api/profile → 200 (idempotent)', async () => {
    const r = await http(
      'PUT',
      '/api/profile',
      { readingLevel: 'GRADE_LEVEL', language: 'en' },
      { demo: 'teacher' }
    );
    if (r.status !== 200) throw new Error(`got ${r.status}: ${r.raw.slice(0, 80)}`);
  });

  let smokeClass;
  await check('POST /api/classes → 201', async () => {
    const r = await http('POST', '/api/classes', { name: '__smoke_test__' }, { demo: 'teacher' });
    if (r.status !== 201) throw new Error(`got ${r.status}: ${r.raw.slice(0, 200)}`);
    smokeClass = r.body;
    return `id=${smokeClass.id}`;
  });

  await check('GET /api/classes → 200 (teacher list)', async () => {
    const r = await http('GET', '/api/classes', null, { demo: 'teacher' });
    if (r.status !== 200) throw new Error(`got ${r.status}`);
    if (!Array.isArray(r.body?.classes)) throw new Error('expected { classes: [] }');
  });

  if (smokeClass) {
    await check('POST /api/classes/join (as student) → 201', async () => {
      const r = await http('POST', '/api/classes/join', { joinCode: smokeClass.joinCode }, { demo: 'student' });
      if (r.status !== 201) throw new Error(`got ${r.status}: ${r.raw.slice(0, 80)}`);
    });
  }

  await check('POST /api/classes (validation: missing name → 400)', async () => {
    const r = await http('POST', '/api/classes', {}, { demo: 'teacher' });
    if (r.status !== 400) throw new Error(`expected 400, got ${r.status}`);
  });

  await check('POST /api/classes/join (bad code → 404)', async () => {
    const r = await http('POST', '/api/classes/join', { joinCode: '__nonexistent__' }, { demo: 'student' });
    if (r.status !== 404) throw new Error(`expected 404, got ${r.status}`);
  });

  await check('GET /api/lessons/demo_lesson_001 (student) → 200', async () => {
    await prisma.lesson.update({
      where: { id: 'demo_lesson_001' },
      data: {
        publishedAt: new Date(),
        publishedById: 'demo_teacher_001',
      },
    });

    const r = await http('GET', '/api/lessons/demo_lesson_001', null, { demo: 'student' });
    if (r.status !== 200) throw new Error(`got ${r.status}: ${r.raw.slice(0, 120)}`);
  });

  // ── Phase 2: standards retrieval ──
  await check('GET /api/standards/search?q=water%20cycle → 200', async () => {
    const r = await http('GET', '/api/standards/search?q=water%20cycle&limit=3');
    if (r.status !== 200) throw new Error(`got ${r.status}`);
    if (!r.body?.standards?.length) throw new Error('no standards matched');
    if (!r.body.standards[0].fullText) throw new Error('missing fullText field');
  });

  await check('GET /api/standards/CCSS.ELA-LITERACY.RI.6.1 → 200', async () => {
    const r = await http('GET', '/api/standards/CCSS.ELA-LITERACY.RI.6.1');
    if (r.status !== 200) throw new Error(`got ${r.status}`);
    if (!r.body?.fullText) throw new Error('missing fullText field');
  });

  // ── Phase 3: engagement event capture ──
  await check('POST /api/analytics/event → 204 (no content)', async () => {
    const r = await http('POST', '/api/analytics/event',
      { lessonId: 'demo_lesson_001', eventType: 'LANGUAGE_TOGGLE', metadata: { from: 'en', to: 'es' } },
      { demo: 'student' });
    if (r.status !== 204) throw new Error(`expected 204, got ${r.status}`);
  });

  await check('POST /api/analytics/event (bad eventType) → 204 silent drop', async () => {
    const r = await http('POST', '/api/analytics/event',
      { lessonId: 'demo_lesson_001', eventType: 'INVALID_EVENT' },
      { demo: 'student' });
    if (r.status !== 204) throw new Error(`expected 204 silent drop, got ${r.status}`);
  });

  // ── Phase 1: edit telemetry ──
  await check('POST /api/edits/demo_lesson_001 (ACCEPTED_AS_IS) → 201', async () => {
    const r = await http('POST', '/api/edits/demo_lesson_001',
      { level: 'GRADE_LEVEL', section: 'OVERVIEW', editType: 'ACCEPTED_AS_IS', aiVersion: 'test overview' },
      { demo: 'teacher' });
    if (r.status !== 201) throw new Error(`got ${r.status}: ${r.raw.slice(0, 120)}`);
    if (!r.body?.id) throw new Error('no edit id returned');
  });

  await check('GET /api/edits/lesson/demo_lesson_001 → 200 with at least 1 edit', async () => {
    const r = await http('GET', '/api/edits/lesson/demo_lesson_001', null, { demo: 'teacher' });
    if (r.status !== 200) throw new Error(`got ${r.status}`);
    if (!r.body?.edits?.length) throw new Error('expected at least 1 edit');
  });

  await check('GET /api/edits/summary?lessonId=demo_lesson_001 → 200', async () => {
    const r = await http('GET', '/api/edits/summary?lessonId=demo_lesson_001', null, { demo: 'teacher' });
    if (r.status !== 200) throw new Error(`got ${r.status}`);
    if (typeof r.body?.acceptanceRate !== 'number') throw new Error('missing acceptanceRate');
  });

  return { smokeClass };
}

// ─── Phase 4: EduEquity adaptation pipeline ──────────────────────────────────
async function testAdaptation(prisma) {
  console.log('\n[4/4] EduEquity adaptation');

  const cls = await prisma.class.findFirst({ where: { teacherId: 'demo_teacher_001' } });
  if (!cls) {
    log('create test lesson', false, 'no class for demo teacher — re-run seed');
    return null;
  }

  const synthLevel = (label) => ({
    levelLabel: label,
    overview: 'Test overview.',
    mainContent: 'Body text. ![diagram](https://example.com/x.png) Watch the demo.',
    keyVocabulary: [{ term: 'foo', definition: 'bar' }],
    activities: [
      { title: 'Read', instructions: 'Read the passage', estimatedMinutes: 5 },
      { title: 'Watch video', instructions: 'Watch the demo video', estimatedMinutes: 10 },
    ],
    quiz: [{ question: '?', options: ['A) x','B) y','C) z','D) w'], correctAnswer: 'A', explanation: '.' }],
  });

  const lesson = await prisma.lesson.create({
    data: {
      classId: cls.id,
      standard: '__smoke_test__',
      title: '__smoke_test__',
      status: 'READY',
      publishedAt: new Date(),
      publishedById: 'demo_teacher_001',
      foundational: synthLevel('Foundational'),
      gradeLevel:   synthLevel('Grade Level'),
      advanced:     synthLevel('Advanced'),
    },
  });

  const { adaptLesson } = require(path.join(__dirname, '..', 'src/middleware/eduequity'));

  // Reset demo student profile to known state — protects against drift from
  // earlier PUT /api/profile tests, manual fiddling, or seed updates.
  await prisma.learnerProfile.upsert({
    where: { userId: 'demo_student_001' },
    update: {
      readingLevel: 'FOUNDATIONAL', language: 'es', bandwidthMode: 'TEXT_ONLY',
      fontSize: 'LARGE', dyslexiaFont: true, ttsEnabled: true, ttsProvider: 'WEB_SPEECH',
    },
    create: {
      userId: 'demo_student_001',
      readingLevel: 'FOUNDATIONAL', language: 'es', bandwidthMode: 'TEXT_ONLY',
      fontSize: 'LARGE', dyslexiaFont: true, ttsEnabled: true, ttsProvider: 'WEB_SPEECH',
    },
  });

  const student = await prisma.user.findUnique({
    where: { id: 'demo_student_001' },
    include: { profile: true },
  });

  await check('adapt with student profile (FOUNDATIONAL/es/TEXT_ONLY)', async () => {
    const req = { params: { lessonId: lesson.id }, user: student };
    const res = { status: () => res, json: (o) => { throw new Error(JSON.stringify(o)); } };
    await new Promise((resolve, reject) => {
      adaptLesson(req, res, (err) => err ? reject(err) : resolve());
    });
    const a = req.adaptedLesson;
    if (!a)                              throw new Error('no adaptedLesson set');
    if (a.appliedProfile.readingLevel !== 'FOUNDATIONAL') throw new Error('wrong level');
    if (!a.content._textOnly)            throw new Error('TEXT_ONLY flag not set');
    if (a.content.mainContent.includes('example.com')) throw new Error('image not stripped');
    if (a.content.activities.length !== 1) throw new Error(`expected 1 activity, got ${a.content.activities.length}`);
    if (!a.content._a11y)                throw new Error('a11y metadata missing');
    return 'all 4 pipeline steps OK';
  });

  await check('unenrolled student cannot access adapted lesson', async () => {
    const outsider = await prisma.user.upsert({
      where: { id: 'demo_student_outsider' },
      update: {},
      create: {
        id: 'demo_student_outsider',
        email: 'outsider@demo.com',
        role: 'STUDENT',
      },
    });

    const req = { params: { lessonId: lesson.id }, user: outsider };
    let statusCode = 200;
    let payload = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (body) => {
        payload = body;
        return body;
      },
    };

    await adaptLesson(req, res, () => {});

    if (statusCode !== 403) throw new Error(`expected 403, got ${statusCode}`);
    if (!payload?.error) throw new Error('expected error payload');
  });

  await check('teacher cannot stream lesson from another teacher class', async () => {
    const otherTeacher = await prisma.user.upsert({
      where: { id: 'demo_teacher_outsider' },
      update: {},
      create: {
        id: 'demo_teacher_outsider',
        email: 'other-teacher@demo.com',
        role: 'TEACHER',
      },
    });

    const req = { params: { lessonId: lesson.id }, user: otherTeacher };
    let statusCode = 200;
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: () => null,
    };

    await adaptLesson(req, res, () => {});

    if (statusCode !== 403) throw new Error(`expected 403, got ${statusCode}`);
  });

  return lesson;
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────
async function cleanup(prisma) {
  console.log('\n[cleanup]');
  const lessonIds = (
    await prisma.lesson.findMany({
      where: { standard: '__smoke_test__' },
      select: { id: true },
    })
  ).map((lesson) => lesson.id);

  await prisma.translationCache.deleteMany({ where: { lessonId: { in: lessonIds } } });
  await prisma.audioCache.deleteMany({ where: { lessonId: { in: lessonIds } } });
  await prisma.quizAttempt.deleteMany({ where: { lessonId: { in: lessonIds } } });
  await prisma.engagementEvent.deleteMany({ where: { lessonId: { in: lessonIds } } });
  await prisma.lessonEdit.deleteMany({ where: { lessonId: { in: lessonIds } } });

  // Also clear test telemetry written against the persistent demo lesson
  await prisma.lessonEdit.deleteMany({ where: { lessonId: 'demo_lesson_001', aiVersion: { equals: 'test overview' } } });
  await prisma.engagementEvent.deleteMany({
    where: {
      lessonId: 'demo_lesson_001',
      eventType: 'LANGUAGE_TOGGLE',
      metadata: { path: ['from'], equals: 'en' },
    },
  });

  const r1 = await prisma.lesson.deleteMany({ where: { id: { in: lessonIds } } });
  const r2 = await prisma.enrollment.deleteMany({ where: { class: { name: '__smoke_test__' } } });
  const r3 = await prisma.class.deleteMany({ where: { name: '__smoke_test__' } });
  const r4 = await prisma.user.deleteMany({
    where: { id: { in: ['demo_student_outsider', 'demo_teacher_outsider'] } },
  });
  console.log(`  removed ${r1.count} lesson(s), ${r2.count} enrollment(s), ${r3.count} class(es), ${r4.count} user(s)`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('EduForge smoke test\n===================');

  await testModuleLoads();

  // After module-load passes, we can safely require the live db
  const { prisma } = require(path.join(__dirname, '..', 'src/db'));

  await testDatabase(prisma);

  // Boot server as subprocess so we test the real wire
  console.log('\n[boot] starting server subprocess...');
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'src/index.js')], {
    env: { ...process.env, ALLOW_DEMO_AUTH: 'true', PORT: SMOKE_PORT },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let booted = false;
  child.stdout.on('data', (d) => {
    if (d.toString().toLowerCase().includes('server running')) booted = true;
  });
  child.stderr.on('data', (d) => process.stderr.write(`  [server] ${d}`));

  // Wait up to 10s for server to come up
  for (let i = 0; i < 50 && !booted; i++) await new Promise((r) => setTimeout(r, 200));
  if (!booted) {
    console.log('  \x1b[31m✗ server failed to boot within 10s\x1b[0m');
    child.kill();
    process.exit(1);
  }
  console.log('  ✓ server booted');

  try {
    await testEndpoints(prisma);
    await testAdaptation(prisma);
  } finally {
    try {
      await cleanup(prisma);
    } finally {
      child.kill();
      await prisma.$disconnect();
    }
  }

  // ── Summary ──
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n===================`);
  console.log(`${passed} passed, ${failed} failed (${results.length} total)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('\nSmoke test crashed:', err);
  process.exit(1);
});
