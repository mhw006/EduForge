const express = require('express');
const prisma = require('../lib/prisma');
const { protect, requireStudent, requireTeacher } = require('../middleware/auth');
const {
  getDiagnosticCatalog,
  getQuestionSet,
  scoreDiagnostic,
  buildDiagnosticFromLesson,
  getPublicQuestions,
  scoreLessonDiagnostic,
  determineReadingLevelFromScore,
  buildAdaptationReason,
} = require('../services/diagnostics');

const router = express.Router();

router.get('/catalog', protect, (_req, res) => {
  res.json({ diagnostics: getDiagnosticCatalog() });
});

router.get('/domains/:domain/questions', protect, requireStudent, (req, res) => {
  try {
    const questionSet = getQuestionSet(req.params.domain);
    res.json(questionSet);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/domains/:domain/submit', protect, requireStudent, async (req, res) => {
  try {
    const { classId, responses } = req.body;
    const userId = req.auth.userId;

    if (!classId) {
      return res.status(400).json({ error: 'classId is required' });
    }
    if (!Array.isArray(responses) || responses.length === 0) {
      return res.status(400).json({ error: 'responses must be a non-empty array' });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_classId: { userId, classId },
      },
    });
    if (!enrollment) {
      return res.status(403).json({ error: 'Not enrolled in this class' });
    }

    const scored = scoreDiagnostic(req.params.domain, responses);

    const attempt = await prisma.diagnosticAttempt.create({
      data: {
        userId,
        classId,
        domain: scored.domain,
        questionSetKey: scored.questionSetKey,
        responses: scored.responses,
        score: scored.score,
        totalQuestions: scored.totalQuestions,
        inferredReadingLevel: scored.inferredReadingLevel,
        inferredMathLevel: scored.inferredMathLevel,
        recommendedProfilePatch: scored.recommendedProfilePatch,
      },
    });

    await prisma.learnerProfile.upsert({
      where: { userId },
      update: {
        ...scored.recommendedProfilePatch,
        recommendedProfilePatch: scored.recommendedProfilePatch,
      },
      create: {
        userId,
        ...scored.recommendedProfilePatch,
        recommendedProfilePatch: scored.recommendedProfilePatch,
      },
    });

    res.status(201).json({
      attemptId: attempt.id,
      domain: scored.domain,
      score: scored.score,
      totalQuestions: scored.totalQuestions,
      percent: scored.percent,
      inferredReadingLevel: scored.inferredReadingLevel,
      inferredMathLevel: scored.inferredMathLevel,
      recommendedProfilePatch: scored.recommendedProfilePatch,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/me/summary', protect, requireStudent, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const attempts = await prisma.diagnosticAttempt.findMany({
      where: { userId },
      orderBy: { completedAt: 'desc' },
      include: {
        class: {
          select: { id: true, name: true },
        },
      },
    });

    const latestByDomain = new Map();
    for (const attempt of attempts) {
      if (!latestByDomain.has(attempt.domain)) {
        latestByDomain.set(attempt.domain, attempt);
      }
    }

    function fmt(attempt, levelField) {
      if (!attempt) return null;
      return {
        attemptId: attempt.id,
        classId: attempt.classId,
        className: attempt.class?.name || null,
        score: attempt.score,
        totalQuestions: attempt.totalQuestions,
        inferredLevel: attempt[levelField],
        completedAt: attempt.completedAt,
      };
    }

    res.json({
      latestReading: fmt(latestByDomain.get('READING'), 'inferredReadingLevel'),
      latestMath:    fmt(latestByDomain.get('MATH'),    'inferredMathLevel'),
      latestScience: fmt(latestByDomain.get('SCIENCE'), 'inferredReadingLevel'),
      totalAttempts: attempts.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/classes/:classId/summary', protect, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.auth.userId;

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                profile: true,
              },
            },
          },
        },
      },
    });

    if (!classRecord || classRecord.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const attempts = await prisma.diagnosticAttempt.findMany({
      where: { classId },
      orderBy: { completedAt: 'desc' },
    });

    const latestByStudentAndDomain = new Map();
    for (const attempt of attempts) {
      const key = `${attempt.userId}:${attempt.domain}`;
      if (!latestByStudentAndDomain.has(key)) {
        latestByStudentAndDomain.set(key, attempt);
      }
    }

    const students = classRecord.enrollments.map((enrollment) => {
      const readingAttempt = latestByStudentAndDomain.get(`${enrollment.userId}:READING`) || null;
      const mathAttempt = latestByStudentAndDomain.get(`${enrollment.userId}:MATH`) || null;
      const scienceAttempt = latestByStudentAndDomain.get(`${enrollment.userId}:SCIENCE`) || null;

      return {
        userId: enrollment.userId,
        email: enrollment.user.email,
        reading: readingAttempt
          ? {
              score: readingAttempt.score,
              totalQuestions: readingAttempt.totalQuestions,
              inferredLevel: readingAttempt.inferredReadingLevel,
              completedAt: readingAttempt.completedAt,
            }
          : null,
        math: mathAttempt
          ? {
              score: mathAttempt.score,
              totalQuestions: mathAttempt.totalQuestions,
              inferredLevel: mathAttempt.inferredMathLevel,
              completedAt: mathAttempt.completedAt,
            }
          : null,
        science: scienceAttempt
          ? {
              score: scienceAttempt.score,
              totalQuestions: scienceAttempt.totalQuestions,
              inferredLevel: scienceAttempt.inferredReadingLevel,
              completedAt: scienceAttempt.completedAt,
            }
          : null,
        currentProfile: enrollment.user.profile,
      };
    });

    res.json({
      classId: classRecord.id,
      className: classRecord.name,
      students,
      totalAttempts: attempts.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /api/diagnostics/classes/:classId/students/:studentId/override ────
// Teacher overrides a student's reading or math level for lesson adaptation
router.patch('/classes/:classId/students/:studentId/override', protect, requireTeacher, async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const teacherId = req.auth.userId;
    const { readingLevel, mathLevel } = req.body;

    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord || classRecord.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_classId: { userId: studentId, classId } },
    });
    if (!enrollment) return res.status(404).json({ error: 'Student not enrolled in this class' });

    const profileUpdates = {};
    if (readingLevel) profileUpdates.readingLevel = readingLevel;
    if (mathLevel) profileUpdates.mathLevel = mathLevel;

    if (Object.keys(profileUpdates).length === 0) {
      return res.status(400).json({ error: 'Provide readingLevel or mathLevel to override' });
    }

    const updatedProfile = await prisma.profile.upsert({
      where: { userId: studentId },
      update: profileUpdates,
      create: { userId: studentId, ...profileUpdates },
    });

    res.json({ studentId, updated: profileUpdates, profile: updatedProfile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/classes/:classId/students/:studentId', protect, requireTeacher, async (req, res) => {
  try {
    const { classId, studentId } = req.params;
    const teacherId = req.auth.userId;

    const classRecord = await prisma.class.findUnique({ where: { id: classId } });
    if (!classRecord || classRecord.teacherId !== teacherId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_classId: { userId: studentId, classId } },
      include: {
        user: {
          include: {
            profile: true,
          },
        },
      },
    });
    if (!enrollment) {
      return res.status(404).json({ error: 'Student is not enrolled in this class' });
    }

    const attempts = await prisma.diagnosticAttempt.findMany({
      where: { classId, userId: studentId },
      orderBy: { completedAt: 'desc' },
    });

    res.json({
      student: {
        userId: enrollment.userId,
        email: enrollment.user.email,
        profile: enrollment.user.profile,
      },
      attempts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/diagnostics/:lessonId ─────────────────────────────────────────
// Returns a 3-question diagnostic derived from the lesson's grade-level quiz.
// correctAnswer is stripped from the public response.
router.get('/:lessonId', protect, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.auth.userId;
    const isDemoUser = userId.startsWith('demo_');

    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, title: true, classId: true, gradeLevel: true, status: true },
    });

    if (!lesson) {
      // Return fallback diagnostic so the UI never breaks
      const { title, questions } = buildDiagnosticFromLesson(null);
      return res.json({ lessonId, title, questions: getPublicQuestions(questions) });
    }

    // Verify access: demo users bypass enrollment, others must be enrolled or be teachers
    if (!isDemoUser && req.user?.role === 'STUDENT') {
      const enrollment = await prisma.enrollment.findUnique({
        where: { userId_classId: { userId, classId: lesson.classId } },
      });
      if (!enrollment) {
        return res.status(403).json({ error: 'Not enrolled in this class' });
      }
    }

    const { title, questions } = buildDiagnosticFromLesson(lesson);

    res.json({
      lessonId: lesson.id,
      title,
      questions: getPublicQuestions(questions),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/diagnostics/:lessonId/submit ──────────────────────────────────
// Scores the student's answers, updates their LearnerProfile readingLevel,
// and returns an adaptation explanation.
router.post('/:lessonId/submit', protect, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { answers } = req.body;
    const userId = req.auth.userId;
    const isDemoUser = userId.startsWith('demo_');

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an object mapping question id to option letter' });
    }

    // Load lesson to reconstruct the answer key
    const lesson = await prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, title: true, classId: true, gradeLevel: true },
    });

    const { questions } = buildDiagnosticFromLesson(lesson);
    const { score, totalQuestions, skillsMissed } = scoreLessonDiagnostic(questions, answers);
    const newReadingLevel = determineReadingLevelFromScore(score, totalQuestions);

    // Read previous reading level and update profile — best-effort for demo compatibility
    let previousReadingLevel = 'GRADE_LEVEL';
    try {
      const existingProfile = await prisma.learnerProfile.findUnique({
        where: { userId },
        select: { readingLevel: true },
      });
      if (existingProfile) previousReadingLevel = existingProfile.readingLevel;

      await prisma.learnerProfile.upsert({
        where: { userId },
        update: {
          readingLevel: newReadingLevel,
          diagnosticReadingLevel: newReadingLevel,
        },
        create: {
          userId,
          readingLevel: newReadingLevel,
          diagnosticReadingLevel: newReadingLevel,
        },
      });
    } catch (dbErr) {
      console.warn('Profile update skipped (demo or missing user):', dbErr.message);
    }

    // Log engagement event — best-effort
    if (!isDemoUser && lesson) {
      try {
        await prisma.engagementEvent.create({
          data: {
            userId,
            lessonId,
            eventType: 'QUIZ_COMPLETE',
            metadata: {
              diagnosticScore: score,
              totalQuestions,
              previousReadingLevel,
              newReadingLevel,
              skillsMissed,
              autoAdapted: true,
            },
          },
        });
      } catch { /* ignore */ }
    }

    const adaptationReason = buildAdaptationReason({ score, totalQuestions, newReadingLevel, skillsMissed });

    res.json({
      lessonId,
      score,
      totalQuestions,
      previousReadingLevel,
      newReadingLevel,
      skillsMissed,
      adaptationReason,
      nextAction: newReadingLevel !== previousReadingLevel
        ? 'Your lesson has been updated. Scroll down to see the adapted content.'
        : 'Your current reading level is a great fit. Keep going!',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
