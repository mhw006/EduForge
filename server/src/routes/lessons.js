const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { adaptContent } = require('../middleware/adapt');
const { generateLessonStream } = require('../services/lessonforge');
const { assertLessonAccess } = require('../lib/lesson-access');
const { isHttpError } = require('../lib/http-error');
const { normalizeLessonPayload } = require('../lib/lesson-schema');
const router = express.Router();

// ─── POST /api/lessons — Create lesson record, return ID ─────────────────────
router.post('/', requireTeacher, async (req, res) => {
  const { classId, standard, gradeLevel = '6', subject = 'ELA' } = req.body;

  if (!classId || !standard) {
    return res.status(400).json({ error: 'classId and standard are required' });
  }

  if (standard.length > 2000) {
    return res.status(400).json({ error: 'Standard text must be under 2000 characters' });
  }

  const cls = await prisma.class.findFirst({
    where: { id: classId, teacherId: req.auth?.userId || req.user?.id },
  });
  if (!cls) return res.status(403).json({ error: 'Class not found or access denied' });

  const lesson = await prisma.lesson.create({
    data: {
      classId,
      standard,
      title: `Lesson: ${standard.substring(0, 60)}`,
      status: 'GENERATING',
    },
  });

  res.status(202).json({ lessonId: lesson.id });
});

// ─── PATCH /api/lessons/:id ───────────────────────────────────────────────────
router.patch('/:id', requireTeacher, async (req, res) => {
  try {
    const { lesson } = await assertLessonAccess({
      lessonId: req.params.id,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
    });

    const allowedFields = ['title', 'foundational', 'gradeLevel', 'advanced'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No editable lesson fields were provided' });
    }

    const merged = normalizeLessonPayload({
      title: updateData.title ?? lesson.title,
      foundational: updateData.foundational ?? lesson.foundational,
      gradeLevel: updateData.gradeLevel ?? lesson.gradeLevel,
      advanced: updateData.advanced ?? lesson.advanced,
    });

    const updated = await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        title: merged.title,
        foundational: merged.foundational,
        gradeLevel: merged.gradeLevel,
        advanced: merged.advanced,
      },
      select: { id: true, title: true, status: true, updatedAt: true },
    });

    res.json({ lesson: updated });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lessons/:id/publish — no-op stub (publishedAt not in schema) ──
router.post('/:id/publish', requireTeacher, async (req, res) => {
  try {
    const { lesson } = await assertLessonAccess({
      lessonId: req.params.id,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
      requireReady: true,
    });
    res.json({ lesson: { id: lesson.id, title: lesson.title, status: lesson.status } });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lessons/:id/unpublish — no-op stub ────────────────────────────
router.post('/:id/unpublish', requireTeacher, async (req, res) => {
  try {
    const { lesson } = await assertLessonAccess({
      lessonId: req.params.id,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
    });
    res.json({ lesson: { id: lesson.id, title: lesson.title, status: lesson.status } });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/lessons/:id/stream — SSE streaming ─────────────────────────────
router.get('/:id/stream', requireTeacher, async (req, res) => {
  let lesson;
  try {
    ({ lesson } = await assertLessonAccess({
      lessonId: req.params.id,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
    }));
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    return res.status(500).json({ error: err.message });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => clearInterval(keepAlive));

  generateLessonStream(
    lesson.standard,
    req.query.gradeLevel || '6',
    req.query.subject || 'ELA',
    (text) => sendEvent('chunk', { text }),
    async (parsed) => {
      clearInterval(keepAlive);
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: {
          title: parsed.title,
          status: 'READY',
          foundational: parsed.foundational,
          gradeLevel: parsed.gradeLevel,
          advanced: parsed.advanced,
        },
      }).catch(() => {});
      sendEvent('complete', { lessonId: lesson.id, title: parsed.title });
      res.end();
    },
    async (err) => {
      clearInterval(keepAlive);
      console.error('LessonForge generation error:', err);
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: 'FAILED' },
      }).catch(() => {});
      sendEvent('error', { message: err.message });
      res.end();
    }
  );
});

// ─── GET /api/lessons/class/:classId ─────────────────────────────────────────
router.get('/class/:classId', requireAuth, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.auth?.userId || req.user?.id;

    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord) return res.status(404).json({ error: 'Class not found' });

    const isTeacher = classRecord.teacherId === userId;
    if (!isTeacher) {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_classId: { userId, classId } },
      });
      if (!enrollment) return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    const lessons = await prisma.lesson.findMany({
      where: { classId, status: 'READY' },
      select: { id: true, title: true, standard: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ lessons });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/lessons/:id ─────────────────────────────────────────────────────
router.get('/:id', requireAuth, adaptContent, async (req, res) => {
  try {
    if (req.adaptedContent) return res.json(req.adaptedContent);

    const { lesson } = await assertLessonAccess({
      lessonId: req.params.id,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: true,
    });

    res.json({
      id: lesson.id,
      title: lesson.title,
      standard: lesson.standard,
      status: lesson.status,
      foundational: lesson.foundational,
      gradeLevel: lesson.gradeLevel,
      advanced: lesson.advanced,
      createdAt: lesson.createdAt,
    });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
