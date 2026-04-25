const { prisma } = require('../db');
const { translateLesson } = require('../services/deepl');

/**
 * Reading level → lesson JSON field mapping
 */
const LEVEL_MAP = {
  FOUNDATIONAL: 'foundational',
  GRADE_LEVEL: 'gradeLevel',
  ADVANCED: 'advanced',
};

/**
 * Strips media for reduced/text-only bandwidth modes.
 * Mirrors the logic from eduequity.js so both adaptation paths behave the same.
 */
function applyBandwidthMode(content, bandwidthMode) {
  if (bandwidthMode === 'FULL') return content;

  const stripped = JSON.parse(JSON.stringify(content));

  if (bandwidthMode === 'REDUCED' || bandwidthMode === 'TEXT_ONLY') {
    if (stripped.mainContent) {
      stripped.mainContent = stripped.mainContent
        .replace(/!\[.*?\]\(.*?\)/g, '[Image removed for bandwidth]')
        .replace(/<img[^>]+>/gi, '')
        .replace(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg)/gi, '');
    }
    if (stripped.reading_passage) {
      stripped.reading_passage = stripped.reading_passage
        .replace(/!\[.*?\]\(.*?\)/g, '')
        .replace(/<img[^>]+>/gi, '');
    }

    if (stripped.activities) {
      stripped.activities = stripped.activities.filter(
        (a) =>
          !a.instructions?.toLowerCase().includes('watch') &&
          !a.instructions?.toLowerCase().includes('video')
      );
    }
  }

  if (bandwidthMode === 'TEXT_ONLY') {
    delete stripped.imageUrl;
    delete stripped.videoUrl;
    stripped._textOnly = true;
  }

  return stripped;
}

/**
 * Injects accessibility metadata for the frontend to consume.
 */
function injectAccessibilityMetadata(content, profile) {
  return {
    ...content,
    _a11y: {
      fontSize: profile.fontSize,
      highContrast: profile.highContrast,
      dyslexiaFont: profile.dyslexiaFont,
      ttsEnabled: profile.ttsEnabled,
      ttsProvider: profile.ttsProvider,
      language: profile.language,
    },
  };
}

/**
 * Adapts lesson content based on the student's LearnerProfile.
 *
 * Pipeline:
 *   1. Select correct differentiation level
 *   2. Translate if needed (with caching)
 *   3. Strip media for bandwidth mode
 *   4. Inject accessibility metadata
 *   5. Log engagement event
 *
 * Attaches `req.adaptedContent` for the route handler to return.
 */
async function adaptContent(req, res, next) {
  try {
    const userId = req.auth?.userId || req.user?.id;
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

    // Step 1: Select the correct differentiation level
    const levelField = LEVEL_MAP[profile.readingLevel] || 'gradeLevel';
    let content = lesson[levelField] || lesson.gradeLevel;

    // Step 2: Translate if needed
    if (profile.language && profile.language !== 'en') {
      try {
        content = await translateLesson(
          content,
          lessonId,
          profile.readingLevel,
          profile.language
        );
      } catch (err) {
        console.warn('Translation failed, serving English:', err.message);
      }
    }

    // Step 3: Apply bandwidth mode
    content = applyBandwidthMode(content, profile.bandwidthMode);

    // Step 4: Inject accessibility metadata
    content = injectAccessibilityMetadata(content, profile);

    // Step 5: Log the view event
    await prisma.engagementEvent
      .create({
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
      })
      .catch((err) => console.warn('Event logging failed:', err.message));

    // Attach adapted content to the request
    req.adaptedContent = {
      lessonId: lesson.id,
      title: lesson.title,
      standard: lesson.standard,
      level: profile.readingLevel,
      appliedProfile: {
        readingLevel: profile.readingLevel,
        language: profile.language,
        bandwidthMode: profile.bandwidthMode,
        ttsProvider: profile.ttsProvider,
      },
      content,
    };

    next();
  } catch (err) {
    console.error('Adaptation middleware error:', err);
    next(err);
  }
}

module.exports = { adaptContent };