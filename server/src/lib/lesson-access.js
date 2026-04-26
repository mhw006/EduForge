const { prisma } = require('../db');
const { HttpError } = require('./http-error');

async function loadLessonAccessContext(lessonId, userId) {
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      class: {
        select: {
          id: true,
          name: true,
          teacherId: true,
          enrollments: userId
            ? {
                where: { userId },
                select: { id: true, userId: true },
              }
            : false,
        },
      },
    },
  });

  if (!lesson) {
    throw new HttpError(404, 'Lesson not found');
  }

  const isTeacherOwner = lesson.class.teacherId === userId;
  const isEnrolledStudent = Array.isArray(lesson.class.enrollments) && lesson.class.enrollments.length > 0;

  return { lesson, isTeacherOwner, isEnrolledStudent };
}

async function assertLessonAccess({
  lessonId,
  userId,
  allowTeacherOwner = false,
  allowEnrolledStudent = false,
  requireReady = false,
  requirePublishedForStudents = false,
}) {
  const context = await loadLessonAccessContext(lessonId, userId);

  if (requireReady && context.lesson.status !== 'READY') {
    throw new HttpError(404, 'Lesson not found or not ready');
  }

  const allowed =
    (allowTeacherOwner && context.isTeacherOwner) ||
    (allowEnrolledStudent && context.isEnrolledStudent);

  if (!allowed) {
    throw new HttpError(403, 'Not authorized');
  }

  if (
    requirePublishedForStudents &&
    context.isEnrolledStudent &&
    !context.isTeacherOwner &&
    !context.lesson.publishedAt
  ) {
    throw new HttpError(403, 'Lesson has not been published yet');
  }

  return context;
}

module.exports = { loadLessonAccessContext, assertLessonAccess };
