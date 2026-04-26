const express = require('express');
const prisma = require('../lib/prisma');
const { protect, requireStudent, requireTeacher } = require('../middleware/auth');
const {
  getDiagnosticCatalog,
  getQuestionSet,
  scoreDiagnostic,
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

module.exports = router;
