const express = require('express');
const { prisma } = require('../db');
const { requireAuth, requireTeacher } = require('../middleware/auth');
const router = express.Router();

// ─── Phase 3: Student engagement event capture ───────────────────────────────
// Lightweight fire-and-forget endpoint students hit on toggle interactions.
// Failures here MUST NEVER break student UX — server returns 204 even on bad
// payloads (we just drop them).
const VALID_EVENT_TYPES = [
  'VIEW', 'QUIZ_START', 'QUIZ_COMPLETE',
  'LANGUAGE_TOGGLE', 'TTS_TOGGLE', 'BANDWIDTH_CHANGE', 'EXPORT_PDF',
];

router.post('/event', requireAuth, async (req, res) => {
  const { lessonId, eventType, metadata = {} } = req.body || {};
  const userId = req.auth?.userId || req.user?.id;

  if (!lessonId || !VALID_EVENT_TYPES.includes(eventType)) {
    return res.status(204).end(); // silently drop invalid events
  }

  try {
    await prisma.engagementEvent.create({
      data: { userId, lessonId, eventType, metadata },
    });
  } catch {
    // FK violation (lessonId doesn't exist) or other transient — silently drop.
  }
  return res.status(204).end();
});

// ─── GET /api/analytics/:classId ─────────────────────────────────────────────
router.get('/:classId', requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.auth?.userId || req.user?.id;

    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        enrollments: {
          include: { user: { select: { id: true, email: true } } },
        },
        lessons: {
          where: { status: 'READY' },
          select: { id: true, title: true },
        },
      },
    });

    if (!classRecord || classRecord.teacherId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const lessonIds = classRecord.lessons.map((l) => l.id);
    const studentIds = classRecord.enrollments.map((e) => e.userId);

    const engagementCounts = await prisma.engagementEvent.groupBy({
      by: ['eventType'],
      where: { lessonId: { in: lessonIds } },
      _count: { id: true },
    });

    const quizStats = await prisma.quizAttempt.groupBy({
      by: ['level'],
      where: { lessonId: { in: lessonIds } },
      _avg: { score: true },
      _count: { id: true },
    });

    const profileDistribution = await prisma.learnerProfile.groupBy({
      by: ['readingLevel'],
      where: { userId: { in: studentIds } },
      _count: { id: true },
    });

    const mathDistribution = await prisma.learnerProfile.groupBy({
      by: ['mathLevel'],
      where: { userId: { in: studentIds } },
      _count: { id: true },
    });

    const studentActivity = await Promise.all(
      classRecord.enrollments.map(async (enrollment) => {
        const sid = enrollment.userId;

        const viewCount = await prisma.engagementEvent.count({
          where: { userId: sid, lessonId: { in: lessonIds }, eventType: 'VIEW' },
        });

        const quizzes = await prisma.quizAttempt.findMany({
          where: { userId: sid, lessonId: { in: lessonIds } },
          select: { score: true, totalQuestions: true },
        });

        const avgScore =
          quizzes.length > 0
            ? Math.round(
                quizzes.reduce((sum, q) => sum + (q.score / q.totalQuestions) * 100, 0) / quizzes.length
              )
            : null;

        return {
          userId: sid,
          email: enrollment.user.email,
          viewCount,
          quizzesCompleted: quizzes.length,
          avgQuizScore: avgScore,
        };
      })
    );

    const lessonEngagement = await Promise.all(
      classRecord.lessons.map(async (lesson) => {
        const views = await prisma.engagementEvent.count({
          where: { lessonId: lesson.id, eventType: 'VIEW' },
        });
        const quizCompletions = await prisma.engagementEvent.count({
          where: { lessonId: lesson.id, eventType: 'QUIZ_COMPLETE' },
        });
        return { lessonId: lesson.id, title: lesson.title, views, quizCompletions };
      })
    );

    res.json({
      className: classRecord.name,
      totalStudents: studentIds.length,
      totalLessons: lessonIds.length,
      engagementCounts: engagementCounts.map((e) => ({ eventType: e.eventType, count: e._count.id })),
      quizStats: quizStats.map((q) => ({ level: q.level, avgScore: Math.round((q._avg.score || 0) * 100) / 100, attempts: q._count.id })),
      readingLevelDistribution: profileDistribution.map((p) => ({ level: p.readingLevel, count: p._count.id })),
      mathLevelDistribution: mathDistribution.map((p) => ({ level: p.mathLevel, count: p._count.id })),
      studentActivity,
      lessonEngagement,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
