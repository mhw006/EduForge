const { PrismaClient } = require('@prisma/client');
const { translateLesson } = require('../services/deepl');

const prisma = new PrismaClient();

function selectLevelContent(lesson, readingLevel) {
  const levelMap = {
    FOUNDATIONAL: lesson.foundational,
    GRADE_LEVEL:  lesson.gradeLevel,
    ADVANCED:     lesson.advanced,
  };
  const content = levelMap[readingLevel];
  if (!content) {
    console.warn(`Level ${readingLevel} not found for lesson ${lesson.id}, falling back to GRADE_LEVEL`);
    return lesson.gradeLevel || lesson.foundational;
  }
  return content;
}

function applyBandwidthMode(content, bandwidthMode) {
  if (bandwidthMode === 'FULL') return content;

  const stripped = JSON.parse(JSON.stringify(content));

  if (bandwidthMode === 'REDUCED' || bandwidthMode === 'TEXT_ONLY') {
    stripped.mainContent = stripped.mainContent
      .replace(/!\[.*?\]\(.*?\)/g, '[Image removed for bandwidth]')
      .replace(/<img[^>]+>/gi, '')
      .replace(/https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|webp|svg)/gi, '');

    stripped.activities = stripped.activities.filter(
      a => !a.instructions?.toLowerCase().includes('watch') &&
           !a.instructions?.toLowerCase().includes('video')
    );
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
      fontSize:     profile.fontSize,
      highContrast: profile.highContrast,
      dyslexiaFont: profile.dyslexiaFont,
      ttsEnabled:   profile.ttsEnabled,
      ttsProvider:  profile.ttsProvider,
      language:     profile.language,
    }
  };
}

async function adaptLesson(req, res, next) {
  const { lessonId } = req.params;

  try {
    const [lesson, profile] = await Promise.all([
      prisma.lesson.findUnique({ where: { id: lessonId } }),
      prisma.learnerProfile.findUnique({ where: { userId: req.user.id } }),
    ]);

    if (!lesson) return res.status(404).json({ error: 'Lesson not found' });
    if (lesson.status !== 'READY') {
      return res.status(409).json({ error: 'Lesson is still generating', status: lesson.status });
    }

    const effectiveProfile = profile || {
      readingLevel: 'GRADE_LEVEL',
      language: 'en',
      bandwidthMode: 'FULL',
      fontSize: 'MEDIUM',
      highContrast: false,
      dyslexiaFont: false,
      ttsEnabled: false,
      ttsProvider: 'WEB_SPEECH',
    };

    let content = selectLevelContent(lesson, effectiveProfile.readingLevel);

    if (effectiveProfile.language !== 'en') {
      content = await translateLesson(content, lesson.id, effectiveProfile.readingLevel, effectiveProfile.language);
    }

    content = applyBandwidthMode(content, effectiveProfile.bandwidthMode);
    content = injectAccessibilityMetadata(content, effectiveProfile);

    req.adaptedLesson = {
      lessonId: lesson.id,
      title: lesson.title,
      standard: lesson.standard,
      appliedProfile: {
        readingLevel:  effectiveProfile.readingLevel,
        language:      effectiveProfile.language,
        bandwidthMode: effectiveProfile.bandwidthMode,
        ttsProvider:   effectiveProfile.ttsProvider,
      },
      content,
    };

    next();
  } catch (err) {
    console.error('EduEquity adaptation error:', err);
    res.status(500).json({ error: 'Adaptation failed', detail: err.message });
  }
}

module.exports = { adaptLesson };
