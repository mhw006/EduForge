const express = require('express');
const { prisma } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { assertLessonAccess, loadLessonAccessContext } = require('../lib/lesson-access');
const { isHttpError } = require('../lib/http-error');
const router = express.Router();

// Reading level → JSON field
const LEVEL_FIELD = {
  FOUNDATIONAL: 'foundational',
  GRADE_LEVEL: 'gradeLevel',
  ADVANCED: 'advanced',
};

// ─── POST /api/quiz/:lessonId/submit ─────────────────────────────────────────
router.post('/:lessonId/submit', requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { answers, level } = req.body;
    const userId = req.auth?.userId || req.user?.id;

    if (req.user?.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Student role required' });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an array' });
    }

    const validLevel = level && LEVEL_FIELD[level] ? level : 'GRADE_LEVEL';

    const { lesson } = await assertLessonAccess({
      lessonId,
      userId,
      allowTeacherOwner: false,
      allowEnrolledStudent: true,
      requireReady: true,
    });

    const levelData = lesson[LEVEL_FIELD[validLevel]];
    if (!levelData || !levelData.quiz) {
      return res.status(400).json({ error: 'No quiz found for this level' });
    }

    const quiz = levelData.quiz;
    const totalQuestions = quiz.length;

    let score = 0;
    const results = quiz.map((question, i) => {
      const studentAnswer = answers[i] || null;
      // Handle both formats: correctAnswer (teammate) or answer (yours)
      const correctAnswer = question.correctAnswer || question.answer;
      const correct = studentAnswer === correctAnswer;
      if (correct) score++;
      return {
        question: question.question,
        studentAnswer,
        correctAnswer,
        correct,
      };
    });

    await prisma.engagementEvent.createMany({
      data: [
        { userId, lessonId, eventType: 'QUIZ_START', metadata: { level: validLevel } },
        { userId, lessonId, eventType: 'QUIZ_COMPLETE', metadata: { level: validLevel, score, totalQuestions } },
      ],
    });

    const attempt = await prisma.quizAttempt.create({
      data: { lessonId, userId, level: validLevel, score, totalQuestions, answers: results },
    });

    res.json({
      attemptId: attempt.id,
      score,
      totalQuestions,
      percentage: Math.round((score / totalQuestions) * 100),
      results,
    });
  } catch (err) {
    if (isHttpError(err)) {
      return res.status(err.status).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/quiz/:lessonId/attempts ────────────────────────────────────────
router.get('/:lessonId/attempts', requireAuth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.auth?.userId || req.user?.id;

    const context = await loadLessonAccessContext(lessonId, userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (user?.role === 'TEACHER' || user?.role === 'ADMIN') {
      if (!context.isTeacherOwner) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    } else if (!context.isEnrolledStudent) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const where = { lessonId };
    if (user?.role !== 'TEACHER') {
      where.userId = userId;
    }

    const attempts = await prisma.quizAttempt.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      attempts: attempts.map((a) => ({
        id: a.id,
        email: a.user.email,
        level: a.level,
        score: a.score,
        totalQuestions: a.totalQuestions,
        percentage: Math.round((a.score / a.totalQuestions) * 100),
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
