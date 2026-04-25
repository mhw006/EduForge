const express = require('express');
const prisma = require('../lib/prisma');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Reading level → JSON field
const LEVEL_FIELD = {
  FOUNDATIONAL: 'foundational',
  GRADE_LEVEL: 'gradeLevel',
  ADVANCED: 'advanced',
};

// ─── POST /api/quiz/:lessonId/submit ─────────────────────────────────────────
// Student submits quiz answers; server scores them
router.post('/:lessonId/submit', protect, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const { answers, level } = req.body;
    const userId = req.auth.userId;

    // Validate
    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({ error: 'answers must be an array' });
    }

    const validLevel = level && LEVEL_FIELD[level] ? level : 'GRADE_LEVEL';

    // Fetch lesson
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.status !== 'READY') {
      return res.status(404).json({ error: 'Lesson not found or not ready' });
    }

    // Get the quiz from the correct level
    const levelData = lesson[LEVEL_FIELD[validLevel]];
    if (!levelData || !levelData.quiz) {
      return res.status(400).json({ error: 'No quiz found for this level' });
    }

    const quiz = levelData.quiz;
    const totalQuestions = quiz.length;

    // Score the answers
    let score = 0;
    const results = quiz.map((question, i) => {
      const studentAnswer = answers[i] || null;
      const correct = studentAnswer === question.answer;
      if (correct) score++;
      return {
        question: question.question,
        studentAnswer,
        correctAnswer: question.answer,
        correct,
      };
    });

    // Log quiz start + completion events
    await prisma.engagementEvent.createMany({
      data: [
        { userId, lessonId, eventType: 'QUIZ_START', metadata: { level: validLevel } },
        {
          userId,
          lessonId,
          eventType: 'QUIZ_COMPLETE',
          metadata: { level: validLevel, score, totalQuestions },
        },
      ],
    });

    // Save the attempt
    const attempt = await prisma.quizAttempt.create({
      data: {
        lessonId,
        userId,
        level: validLevel,
        score,
        totalQuestions,
        answers: results,
      },
    });

    res.json({
      attemptId: attempt.id,
      score,
      totalQuestions,
      percentage: Math.round((score / totalQuestions) * 100),
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/quiz/:lessonId/attempts ────────────────────────────────────────
// Get quiz attempts for a lesson (student sees own, teacher sees all)
router.get('/:lessonId/attempts', protect, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.auth.userId;

    const user = await prisma.user.findUnique({ where: { id: userId } });

    const where = { lessonId };
    if (user?.role !== 'TEACHER') {
      where.userId = userId;
    }

    const attempts = await prisma.quizAttempt.findMany({
      where,
      include: {
        user: { select: { email: true } },
      },
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