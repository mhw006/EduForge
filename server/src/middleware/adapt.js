const prisma = require('../lib/prisma');
const { translateText } = require('../services/translate');

/**
 * Reading level → lesson JSON field mapping
 */
const LEVEL_MAP = {
  FOUNDATIONAL: 'foundational',
  GRADE_LEVEL: 'gradeLevel',
  ADVANCED: 'advanced',
};

/**
 * Adapts lesson content based on the student's LearnerProfile.
 *
 * Attaches `req.adaptedContent` with:
 *   - content: the correct differentiation level, optionally translated
 *   - profile: the student's accessibility settings for frontend rendering
 *   - level: which level was selected
 *
 * Use on routes that serve lesson content to students.
 */
async function adaptContent(req, res, next) {
  try {
    const userId = req.auth?.userId;
    if (!userId) return next();

    // Only adapt for students
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.role !== 'STUDENT') return next();

    // Get or create learner profile
    let profile = await prisma.learnerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.learnerProfile.create({
        data: { userId },
      });
    }

    // Get the lesson from the route param
    const lessonId = req.params.id || req.params.lessonId;
    if (!lessonId) return next();

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.status !== 'READY') return next();

    // Select the correct differentiation level
    const levelField = LEVEL_MAP[profile.readingLevel] || 'gradeLevel';
    let content = lesson[levelField] || lesson.gradeLevel;

    // Translate if needed
    if (profile.language && profile.language !== 'en') {
      try {
        content = await translateText(
          typeof content === 'string' ? content : JSON.stringify(content),
          profile.language,
          { lessonId, level: profile.readingLevel }
        );
        // Parse back if it was JSON
        if (typeof content === 'string') {
          try {
            content = JSON.parse(content);
          } catch {
            // Leave as string if it's not valid JSON after translation
          }
        }
      } catch (err) {
        console.warn('Translation failed, serving English:', err.message);
        // Fall through with untranslated content
      }
    }

    // Log the view event
    await prisma.engagementEvent.create({
      data: {
        userId,
        lessonId,
        eventType: 'VIEW',
        metadata: {
          level: profile.readingLevel,
          language: profile.language,
          bandwidthMode: profile.bandwidthMode,
        },
      },
    }).catch((err) => console.warn('Event logging failed:', err.message));

    // Attach adapted content to the request
    req.adaptedContent = {
      lessonId: lesson.id,
      title: lesson.title,
      standard: lesson.standard,
      level: profile.readingLevel,
      content,
      profile: {
        language: profile.language,
        bandwidthMode: profile.bandwidthMode,
        fontSize: profile.fontSize,
        highContrast: profile.highContrast,
        dyslexiaFont: profile.dyslexiaFont,
        ttsEnabled: profile.ttsEnabled,
        ttsProvider: profile.ttsProvider,
      },
    };

    next();
  } catch (err) {
    console.error('Adaptation middleware error:', err);
    next(err);
  }
}

module.exports = { adaptContent };