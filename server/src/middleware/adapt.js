const { buildAuthorizedAdaptedLesson } = require('../services/adaptation');
const { isHttpError } = require('../lib/http-error');

async function adaptContent(req, res, next) {
  try {
    const userId = req.auth?.userId || req.user?.id;
    if (!userId) return next();

    // Only students should receive inline adaptation on the lesson fetch route.
    if (req.user?.role !== 'STUDENT') return next();

    req.adaptedContent = await buildAuthorizedAdaptedLesson({
      lessonId: req.params.id || req.params.lessonId,
      userId,
      allowTeacherOwner: false,
      allowEnrolledStudent: true,
      logViewEvent: true,
      requirePublishedForStudents: false,
    });

    next();
  } catch (err) {
    if (isHttpError(err)) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Adaptation middleware error:', err);
    next(err);
  }
}

module.exports = { adaptContent };
