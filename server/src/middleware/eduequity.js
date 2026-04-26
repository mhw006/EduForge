const { buildAuthorizedAdaptedLesson } = require('../services/adaptation');
const { isHttpError } = require('../lib/http-error');

async function adaptLesson(req, res, next) {
  try {
    req.adaptedLesson = await buildAuthorizedAdaptedLesson({
      lessonId: req.params.lessonId,
      userId: req.user.id,
      allowTeacherOwner: true,
      allowEnrolledStudent: true,
      logViewEvent: true,
    });

    next();
  } catch (err) {
    if (isHttpError(err)) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('EduEquity adaptation error:', err);
    res.status(500).json({ error: 'Adaptation failed', detail: err.message });
  }
}

module.exports = { adaptLesson };
