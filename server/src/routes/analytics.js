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

function roundScore(value) {
  return Math.round((value || 0) * 100) / 100;
}

function topCountEntry(items, key = 'count') {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items.reduce((best, item) => (!best || (item[key] || 0) > (best[key] || 0) ? item : best), null);
}

function buildRecommendations({
  lowestQuizLevel,
  topEvent,
  mostViewedLesson,
  leastCompletedLesson,
  foundationalCount,
  totalStudents,
  editSectionSummary,
}) {
  const recommendations = [];

  if (lowestQuizLevel && lowestQuizLevel.avgScore < 70) {
    recommendations.push(
      `${lowestQuizLevel.level.replace('_', ' ')} learners are averaging ${Math.round(lowestQuizLevel.avgScore)}% on quizzes. Consider publishing stronger scaffolds before assessment.`
    );
  }

  const mostRewrittenSection = topCountEntry(editSectionSummary, 'modified');
  if (mostRewrittenSection && mostRewrittenSection.modified > 0) {
    recommendations.push(
      `${mostRewrittenSection.section.replace('_', ' ')} is being rewritten most often by teachers. Review that section carefully before publishing new lessons.`
    );
  }

  if (topEvent?.eventType === 'LANGUAGE_TOGGLE' && topEvent.count > 0) {
    recommendations.push(
      'Students are frequently switching languages. Prioritize translation review for key vocabulary and quiz prompts.'
    );
  } else if (topEvent?.eventType === 'BANDWIDTH_CHANGE' && topEvent.count > 0) {
    recommendations.push(
      'Students are changing bandwidth modes often. Keep lesson content resilient in text-only and reduced-media formats.'
    );
  }

  if (
    mostViewedLesson &&
    leastCompletedLesson &&
    mostViewedLesson.lessonId === leastCompletedLesson.lessonId &&
    mostViewedLesson.views > leastCompletedLesson.quizCompletions
  ) {
    recommendations.push(
      `${mostViewedLesson.title} is drawing views but fewer quiz completions. Break the assessment into smaller checkpoints or add stronger pre-teach supports.`
    );
  }

  if (totalStudents > 0 && foundationalCount / totalStudents >= 0.5) {
    recommendations.push(
      'A large share of this class is reading at the foundational level. Defaulting to simpler vocabulary and more scaffolds may improve access.'
    );
  }

  return recommendations.slice(0, 3);
}

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

    const [
      engagementCounts,
      quizStats,
      profileDistribution,
      mathDistribution,
      publishedLessonCount,
      diagnosticAttemptsCount,
      aiEditsLogged,
      totalQuizAttempts,
      editSectionType,
    ] = await Promise.all([
      prisma.engagementEvent.groupBy({
        by: ['eventType'],
        where: { lessonId: { in: lessonIds } },
        _count: { id: true },
      }),
      prisma.quizAttempt.groupBy({
        by: ['level'],
        where: { lessonId: { in: lessonIds } },
        _avg: { score: true },
        _count: { id: true },
      }),
      prisma.learnerProfile.groupBy({
        by: ['readingLevel'],
        where: { userId: { in: studentIds } },
        _count: { id: true },
      }),
      prisma.learnerProfile.groupBy({
        by: ['mathLevel'],
        where: { userId: { in: studentIds } },
        _count: { id: true },
      }),
      prisma.lesson.count({
        where: { classId, status: 'READY', publishedAt: { not: null } },
      }),
      prisma.diagnosticAttempt.count({
        where: { classId },
      }),
      prisma.lessonEdit.count({
        where: { lessonId: { in: lessonIds } },
      }),
      prisma.quizAttempt.count({
        where: { lessonId: { in: lessonIds } },
      }),
      prisma.lessonEdit.groupBy({
        by: ['section', 'editType'],
        where: { lessonId: { in: lessonIds } },
        _count: { id: true },
      }),
    ]);

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

    const mappedEngagementCounts = engagementCounts.map((e) => ({ eventType: e.eventType, count: e._count.id }));
    const mappedQuizStats = quizStats.map((q) => ({
      level: q.level,
      avgScore: roundScore(q._avg.score),
      attempts: q._count.id,
    }));
    const mappedReadingDistribution = profileDistribution.map((p) => ({ level: p.readingLevel, count: p._count.id }));
    const mappedMathDistribution = mathDistribution.map((p) => ({ level: p.mathLevel, count: p._count.id }));

    const editSectionSummary = ['TITLE', 'OVERVIEW', 'MAIN_CONTENT', 'KEY_VOCABULARY', 'ACTIVITIES', 'QUIZ']
      .map((section) => {
        const modified = editSectionType.find((row) => row.section === section && row.editType === 'MODIFIED')?._count.id || 0;
        const accepted = editSectionType.find((row) => row.section === section && row.editType === 'ACCEPTED_AS_IS')?._count.id || 0;
        const regenerated = editSectionType.find((row) => row.section === section && row.editType === 'REGENERATED')?._count.id || 0;
        return { section, modified, accepted, regenerated, total: modified + accepted + regenerated };
      })
      .filter((row) => row.total > 0);

    const topEvent = topCountEntry(mappedEngagementCounts);
    const mostViewedLesson = topCountEntry(lessonEngagement, 'views');
    const leastCompletedLesson = lessonEngagement.length
      ? lessonEngagement.reduce((lowest, lesson) => (
          !lowest || lesson.quizCompletions < lowest.quizCompletions ? lesson : lowest
        ), null)
      : null;
    const lowestQuizLevel = mappedQuizStats.length
      ? mappedQuizStats.reduce((lowest, level) => (!lowest || level.avgScore < lowest.avgScore ? level : lowest), null)
      : null;
    const foundationalCount = mappedReadingDistribution.find((row) => row.level === 'FOUNDATIONAL')?.count || 0;
    const totalEngagementEvents = mappedEngagementCounts.reduce((sum, item) => sum + item.count, 0);

    const insights = {
      mostViewedLesson: mostViewedLesson
        ? { lessonId: mostViewedLesson.lessonId, title: mostViewedLesson.title, views: mostViewedLesson.views }
        : null,
      leastCompletedLesson: leastCompletedLesson
        ? { lessonId: leastCompletedLesson.lessonId, title: leastCompletedLesson.title, quizCompletions: leastCompletedLesson.quizCompletions }
        : null,
      topEventType: topEvent?.eventType || null,
      avgQuizScoreOverall: mappedQuizStats.length
        ? Math.round(mappedQuizStats.reduce((sum, item) => sum + item.avgScore, 0) / mappedQuizStats.length)
        : null,
      lowestPerformingLevel: lowestQuizLevel?.level || null,
      studentsNeedingSupport: foundationalCount,
      mostEditedSection: topCountEntry(editSectionSummary, 'modified')?.section || null,
    };

    const loopMetrics = {
      publishedLessons: publishedLessonCount,
      diagnosticsCompleted: diagnosticAttemptsCount,
      aiEditsLogged,
      quizAttempts: totalQuizAttempts,
      engagementEvents: totalEngagementEvents,
      studentsTracked: studentIds.length,
    };

    const recommendations = buildRecommendations({
      lowestQuizLevel,
      topEvent,
      mostViewedLesson,
      leastCompletedLesson,
      foundationalCount,
      totalStudents: studentIds.length,
      editSectionSummary,
    });

    res.json({
      className: classRecord.name,
      totalStudents: studentIds.length,
      totalLessons: lessonIds.length,
      engagementCounts: mappedEngagementCounts,
      quizStats: mappedQuizStats,
      readingLevelDistribution: mappedReadingDistribution,
      mathLevelDistribution: mappedMathDistribution,
      studentActivity,
      lessonEngagement,
      editSectionSummary,
      insights,
      loopMetrics,
      recommendations,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
