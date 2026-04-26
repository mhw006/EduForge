const express = require('express');
const prisma = require('../lib/prisma');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const { adaptContent } = require('../middleware/adapt');
const { generateLessonStream } = require('../services/lessonforge');
const { assertLessonAccess } = require('../lib/lesson-access');
const { isHttpError } = require('../lib/http-error');
const { normalizeLessonPayload } = require('../lib/lesson-schema');
const demoStore = require('../services/demo-store');
const router = express.Router();

const LEVEL_MAP = {
  FOUNDATIONAL: 'foundational',
  GRADE_LEVEL: 'gradeLevel',
  ADVANCED: 'advanced',
};

// ─── POST /api/lessons — Create lesson record, return ID ─────────────────────
router.post('/', requireTeacher, async (req, res) => {
  const { classId, standard, gradeLevel = '6', subject = 'ELA' } = req.body;

  if (!classId || !standard) {
    return res.status(400).json({ error: 'classId and standard are required' });
  }

  if (standard.length > 2000) {
    return res.status(400).json({ error: 'Standard text must be under 2000 characters' });
  }

  if (demoStore.isDemoStoreEnabled()) {
    const lesson = demoStore.saveLesson({
      classId,
      title: `Lesson: ${standard.substring(0, 60)}`,
      standard,
      teacherId: req.auth?.userId || req.user?.id,
      lesson: {
        title: `Lesson: ${standard.substring(0, 60)}`,
        subject,
        targetGrade: gradeLevel,
        standard,
        estimatedMinutes: 30,
        foundational: {
          levelLabel: 'Foundational',
          lexileRange: '400L-600L',
          overview: standard,
          keyVocabulary: [{ term: 'Goal', definition: 'What you will learn.' }],
          mainContent: standard,
          activities: [{ title: 'Quick Start', instructions: 'Read the goal and underline key ideas.', estimatedMinutes: 5 }],
          quiz: Array.from({ length: 5 }, (_, index) => ({
            question: `Check ${index + 1}: What is this lesson about?`,
            options: ['A) The learning goal', 'B) A random topic', 'C) A game only', 'D) None'],
            correctAnswer: 'A',
            explanation: 'The lesson focuses on the learning goal.',
          })),
        },
        gradeLevel: {
          levelLabel: 'Grade Level',
          lexileRange: '700L-900L',
          overview: standard,
          keyVocabulary: [{ term: 'Concept', definition: 'An important idea.' }],
          mainContent: standard,
          activities: [{ title: 'Practice', instructions: 'Explain the idea in your own words.', estimatedMinutes: 10 }],
          quiz: Array.from({ length: 5 }, (_, index) => ({
            question: `Check ${index + 1}: Which answer best matches the lesson goal?`,
            options: ['A) The core concept', 'B) An unrelated detail', 'C) A distraction', 'D) No answer'],
            correctAnswer: 'A',
            explanation: 'The core concept matches the lesson goal.',
          })),
        },
        advanced: {
          levelLabel: 'Advanced',
          lexileRange: '1000L-1200L',
          overview: standard,
          keyVocabulary: [{ term: 'Analysis', definition: 'Careful study of an idea.' }],
          mainContent: standard,
          activities: [{ title: 'Extend', instructions: 'Connect this idea to a new example.', estimatedMinutes: 12 }],
          quiz: Array.from({ length: 5 }, (_, index) => ({
            question: `Check ${index + 1}: How can you extend this concept?`,
            options: ['A) Apply it to a new case', 'B) Ignore the evidence', 'C) Change the topic', 'D) Skip it'],
            correctAnswer: 'A',
            explanation: 'Applying it to a new case extends the concept.',
          })),
        },
      },
    });
    if (!lesson) return res.status(403).json({ error: 'Class not found or access denied' });
    return res.status(202).json({ lessonId: lesson.id });
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
    await prisma.translationCache.deleteMany({ where: { lessonId: lesson.id } });

    res.json({ lesson: updated });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lessons/:id/publish ────────────────────────────────────────────
router.post('/:id/publish', requireTeacher, async (req, res) => {
  try {
    if (demoStore.isDemoStoreEnabled()) {
      const lesson = demoStore.publishLesson({ lessonId: req.params.id, teacherId: req.auth?.userId || req.user?.id });
      if (lesson === null) return res.status(404).json({ error: 'Lesson not found' });
      if (lesson === false) return res.status(403).json({ error: 'Lesson not found or not yours' });
      return res.json({
        lesson: {
          id: lesson.id,
          title: lesson.title,
          status: lesson.status,
          publishedAt: lesson.publishedAt,
        },
      });
    }

    const { lesson } = await assertLessonAccess({
      lessonId: req.params.id,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
      requireReady: true,
    });
    const publishedLesson = await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        publishedAt: new Date(),
        publishedById: req.auth?.userId || req.user?.id,
      },
      select: {
        id: true,
        title: true,
        status: true,
        publishedAt: true,
      },
    });
    res.json({ lesson: publishedLesson });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/lessons/:id/unpublish ──────────────────────────────────────────
router.post('/:id/unpublish', requireTeacher, async (req, res) => {
  try {
    if (demoStore.isDemoStoreEnabled()) {
      const lesson = demoStore.unpublishLesson({ lessonId: req.params.id, teacherId: req.auth?.userId || req.user?.id });
      if (lesson === null) return res.status(404).json({ error: 'Lesson not found' });
      if (lesson === false) return res.status(403).json({ error: 'Lesson not found or not yours' });
      return res.json({
        lesson: {
          id: lesson.id,
          title: lesson.title,
          status: lesson.status,
          publishedAt: lesson.publishedAt,
        },
      });
    }

    const { lesson } = await assertLessonAccess({
      lessonId: req.params.id,
      userId: req.auth?.userId || req.user?.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: false,
    });
    const unpublishedLesson = await prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        publishedAt: null,
        publishedById: null,
      },
      select: {
        id: true,
        title: true,
        status: true,
        publishedAt: true,
      },
    });
    res.json({ lesson: unpublishedLesson });
  } catch (err) {
    if (isHttpError(err)) return res.status(err.status).json({ error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /api/lessons/:id ─────────────────────────────────────────────────
router.delete('/:id', requireTeacher, async (req, res) => {
  try {
    const userId = req.auth?.userId || req.user?.id;
    if (demoStore.isDemoStoreEnabled()) {
      const deleted = demoStore.deleteLesson({ lessonId: req.params.id, teacherId: userId });
      if (!deleted) return res.status(404).json({ error: 'Lesson not found or not yours' });
      return res.json({ deleted: true, lessonId: req.params.id });
    }

    const lesson = await prisma.lesson.findFirst({
      where: { id: req.params.id, teacherId: userId },
    });
    if (!lesson) return res.status(404).json({ error: 'Lesson not found or not yours' });

    await prisma.translationCache.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.audioCache.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.lessonEdit.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.quizAttempt.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.engagementEvent.deleteMany({ where: { lessonId: lesson.id } });
    await prisma.lesson.delete({ where: { id: lesson.id } });

    res.json({ deleted: true, lessonId: lesson.id });
  } catch (err) {
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
      await prisma.translationCache.deleteMany({ where: { lessonId: lesson.id } }).catch(() => {});
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

    if (demoStore.isDemoStoreEnabled()) {
      const lessons = demoStore.listLessonsForClass({ classId, userId, role: req.user?.role });
      if (lessons === null) return res.status(404).json({ error: 'Class not found' });
      if (lessons === false) return res.status(403).json({ error: 'Not enrolled in this class' });
      return res.json({ lessons });
    }

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
      where: isTeacher
        ? { classId, status: 'READY' }
        : { classId, status: 'READY', publishedAt: { not: null } },
      select: { id: true, title: true, standard: true, status: true, publishedAt: true, createdAt: true },
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

    if (demoStore.isDemoStoreEnabled()) {
      const userId = req.auth?.userId || req.user?.id;
      const role = req.user?.role;
      const lesson = demoStore.getLesson({
        lessonId: req.params.id,
        userId,
        role,
      });
      if (lesson === null) return res.status(404).json({ error: 'Lesson not found' });
      if (lesson === false) return res.status(403).json({ error: 'Lesson not available' });

      if (role === 'STUDENT') {
        const profile = demoStore.getProfile(userId);
        const levelKey = LEVEL_MAP[profile.readingLevel] || 'gradeLevel';
        const content = lesson[levelKey] || lesson.gradeLevel || lesson.foundational || lesson.advanced;
        return res.json({
          id: lesson.id,
          lessonId: lesson.id,
          title: lesson.title,
          standard: lesson.standard,
          appliedProfile: {
            readingLevel: profile.readingLevel,
            diagnosticReadingLevel: profile.diagnosticReadingLevel,
            diagnosticMathLevel: profile.diagnosticMathLevel,
            language: profile.language,
            bandwidthMode: profile.bandwidthMode,
            preferredContentFormat: profile.preferredContentFormat,
            recommendedProfilePatch: profile.recommendedProfilePatch,
            ttsProvider: profile.ttsProvider,
          },
          content: {
            ...content,
            _a11y: {
              fontSize: profile.fontSize,
              highContrast: profile.highContrast,
              dyslexiaFont: profile.dyslexiaFont,
              ttsEnabled: profile.ttsEnabled,
              ttsProvider: profile.ttsProvider,
              language: profile.language,
            },
          },
        });
      }

      return res.json({
        id: lesson.id,
        title: lesson.title,
        standard: lesson.standard,
        status: lesson.status,
        publishedAt: lesson.publishedAt,
        foundational: lesson.foundational,
        gradeLevel: lesson.gradeLevel,
        advanced: lesson.advanced,
        createdAt: lesson.createdAt,
      });
    }

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
      publishedAt: lesson.publishedAt,
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
