const express = require('express');
const prisma = require('../lib/prisma');
const { protect, requireTeacher } = require('../middleware/auth');
const router = express.Router();

// ─── GET /api/analytics/:classId ─────────────────────────────────────────────
// Teacher dashboard: aggregated stats for a class
router.get('/:classId', protect, requireTeacher, async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.auth.userId;

    // Verify teacher owns this class
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

    // 1. Engagement counts by event type
    const engagementCounts = await prisma.engagementEvent.groupBy({
      by: ['eventType'],
      where: { lessonId: { in: lessonIds } },
      _count: { id: true },
    });

    // 2. Quiz scores by level
    const quizStats = await prisma.quizAttempt.groupBy({
      by: ['level'],
      where: { lessonId: { in: lessonIds } },
      _avg: { score: true },
      _count: { id: true },
    });

    // 3. Most-used reading level (from engagement metadata)
    const profileDistribution = await prisma.learnerProfile.groupBy({
      by: ['readingLevel'],
      where: { userId: { in: studentIds } },
      _count: { id: true },
    });

    // 4. Per-student activity summary
    const studentActivity = await Promise.all(
      classRecord.enrollments.map(async (enrollment) => {
        const sid = enrollment.userId;

        const viewCount = await prisma.engagementEvent.count({
          where: {
            userId: sid,
            lessonId: { in: lessonIds },
            eventType: 'VIEW',
          },
        });

        const quizzes = await prisma.quizAttempt.findMany({
          where: { userId: sid, lessonId: { in: lessonIds } },
          select: { score: true, totalQuestions: true },
        });

        const avgScore =
          quizzes.length > 0
            ? Math.round(
                quizzes.reduce((sum, q) => sum + (q.score / q.totalQuestions) * 100, 0) /
                  quizzes.length
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

    // 5. Per-lesson engagement
    const lessonEngagement = await Promise.all(
      classRecord.lessons.map(async (lesson) => {
        const views = await prisma.engagementEvent.count({
          where: { lessonId: lesson.id, eventType: 'VIEW' },
        });
        const quizCompletions = await prisma.engagementEvent.count({
          where: { lessonId: lesson.id, eventType: 'QUIZ_COMPLETE' },
        });
        return {
          lessonId: lesson.id,
          title: lesson.title,
          views,
          quizCompletions,
        };
      })
    );

    res.json({
      className: classRecord.name,
      totalStudents: studentIds.length,
      totalLessons: lessonIds.length,
      engagementCounts: engagementCounts.map((e) => ({
        eventType: e.eventType,
        count: e._count.id,
      })),
      quizStats: quizStats.map((q) => ({
        level: q.level,
        avgScore: Math.round((q._avg.score || 0) * 100) / 100,
        attempts: q._count.id,
      })),
      readingLevelDistribution: profileDistribution.map((p) => ({
        level: p.readingLevel,
        count: p._count.id,
      })),
      studentActivity,
      lessonEngagement,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;