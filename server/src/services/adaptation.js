const { prisma } = require('../db');
const { translateLesson } = require('./deepl');
const { HttpError } = require('../lib/http-error');
const { assertLessonAccess } = require('../lib/lesson-access');

const DEFAULT_PROFILE = {
  readingLevel: 'GRADE_LEVEL',
  language: 'en',
  bandwidthMode: 'FULL',
  fontSize: 'MEDIUM',
  highContrast: false,
  dyslexiaFont: false,
  ttsEnabled: false,
  ttsProvider: 'WEB_SPEECH',
};

const LEVEL_MAP = {
  FOUNDATIONAL: 'foundational',
  GRADE_LEVEL: 'gradeLevel',
  ADVANCED: 'advanced',
};

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

    if (Array.isArray(stripped.activities)) {
      stripped.activities = stripped.activities.filter(
        (activity) =>
          !activity.instructions?.toLowerCase().includes('watch') &&
          !activity.instructions?.toLowerCase().includes('video')
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

function selectLevelContent(lesson, readingLevel) {
  const levelField = LEVEL_MAP[readingLevel] || 'gradeLevel';
  return lesson[levelField] || lesson.gradeLevel || lesson.foundational || lesson.advanced;
}

async function getEffectiveProfile(userId) {
  let profile = await prisma.learnerProfile.findUnique({ where: { userId } });

  if (!profile) {
    profile = await prisma.learnerProfile.create({
      data: { userId },
    });
  }

  return { ...DEFAULT_PROFILE, ...profile };
}

async function buildAdaptedLesson({
  lesson,
  userId,
  logViewEvent = true,
}) {
  if (!lesson || lesson.status !== 'READY') {
    throw new HttpError(404, 'Lesson not found or not ready');
  }

  const profile = await getEffectiveProfile(userId);
  let content = selectLevelContent(lesson, profile.readingLevel);

  if (!content) {
    throw new HttpError(500, 'Lesson is missing differentiated content');
  }

  if (profile.language && profile.language.toLowerCase() !== 'en') {
    content = await translateLesson(content, lesson.id, profile.readingLevel, profile.language);
  }

  content = applyBandwidthMode(content, profile.bandwidthMode);
  content = injectAccessibilityMetadata(content, profile);

  if (logViewEvent) {
    await prisma.engagementEvent.create({
      data: {
        userId,
        lessonId: lesson.id,
        eventType: 'VIEW',
        metadata: {
          level: profile.readingLevel,
          language: profile.language,
          bandwidthMode: profile.bandwidthMode,
        },
      },
    }).catch((err) => console.warn('Event logging failed:', err.message));
  }

  return {
    lessonId: lesson.id,
    title: lesson.title,
    standard: lesson.standard,
    appliedProfile: {
      readingLevel: profile.readingLevel,
      language: profile.language,
      bandwidthMode: profile.bandwidthMode,
      ttsProvider: profile.ttsProvider,
    },
    content,
  };
}

async function buildAuthorizedAdaptedLesson({
  lessonId,
  userId,
  allowTeacherOwner = true,
  allowEnrolledStudent = true,
  logViewEvent = true,
}) {
  const { lesson } = await assertLessonAccess({
    lessonId,
    userId,
    allowTeacherOwner,
    allowEnrolledStudent,
    requireReady: true,
  });

  return buildAdaptedLesson({ lesson, userId, logViewEvent });
}

module.exports = {
  DEFAULT_PROFILE,
  applyBandwidthMode,
  injectAccessibilityMetadata,
  getEffectiveProfile,
  buildAdaptedLesson,
  buildAuthorizedAdaptedLesson,
};
