const express = require('express');
const prisma = require('../lib/prisma');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Valid enum values for server-side validation
const VALID_READING_LEVELS = ['FOUNDATIONAL', 'GRADE_LEVEL', 'ADVANCED'];
const VALID_MATH_LEVELS = ['BELOW_GRADE', 'GRADE_LEVEL', 'ADVANCED'];
const VALID_BANDWIDTH_MODES = ['FULL', 'REDUCED', 'TEXT_ONLY'];
const VALID_FONT_SIZES = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'];
const VALID_TTS_PROVIDERS = ['ELEVENLABS', 'WEB_SPEECH'];
const VALID_CONTENT_FORMATS = ['MIXED_MEDIA', 'TEXT_FOCUSED', 'AUDIO_FOCUSED'];

// ─── GET /api/profile ────────────────────────────────────────────────────────
// Returns the current user's learner profile (creates default if none exists)
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.auth.userId;

    let profile = await prisma.learnerProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      profile = await prisma.learnerProfile.create({
        data: { userId },
      });
    }

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PUT /api/profile ────────────────────────────────────────────────────────
// Update the current user's learner profile
router.put('/', protect, async (req, res) => {
  try {
    const userId = req.auth.userId;
    const {
      readingLevel,
      diagnosticReadingLevel,
      gradeLevelLabel,
      readingLexile,
      mathLevel,
      diagnosticMathLevel,
      language,
      bandwidthMode,
      fontSize,
      highContrast,
      dyslexiaFont,
      screenReaderMode,
      reducedMotion,
      preferredContentFormat,
      supportFlags,
      recommendedProfilePatch,
      ttsEnabled,
      ttsProvider,
    } = req.body;

    // Validate enums
    const errors = [];

    if (readingLevel && !VALID_READING_LEVELS.includes(readingLevel)) {
      errors.push(`readingLevel must be one of: ${VALID_READING_LEVELS.join(', ')}`);
    }
    if (diagnosticReadingLevel && !VALID_READING_LEVELS.includes(diagnosticReadingLevel)) {
      errors.push(`diagnosticReadingLevel must be one of: ${VALID_READING_LEVELS.join(', ')}`);
    }
    if (mathLevel && !VALID_MATH_LEVELS.includes(mathLevel)) {
      errors.push(`mathLevel must be one of: ${VALID_MATH_LEVELS.join(', ')}`);
    }
    if (diagnosticMathLevel && !VALID_MATH_LEVELS.includes(diagnosticMathLevel)) {
      errors.push(`diagnosticMathLevel must be one of: ${VALID_MATH_LEVELS.join(', ')}`);
    }
    if (bandwidthMode && !VALID_BANDWIDTH_MODES.includes(bandwidthMode)) {
      errors.push(`bandwidthMode must be one of: ${VALID_BANDWIDTH_MODES.join(', ')}`);
    }
    if (fontSize && !VALID_FONT_SIZES.includes(fontSize)) {
      errors.push(`fontSize must be one of: ${VALID_FONT_SIZES.join(', ')}`);
    }
    if (ttsProvider && !VALID_TTS_PROVIDERS.includes(ttsProvider)) {
      errors.push(`ttsProvider must be one of: ${VALID_TTS_PROVIDERS.join(', ')}`);
    }
    if (preferredContentFormat && !VALID_CONTENT_FORMATS.includes(preferredContentFormat)) {
      errors.push(`preferredContentFormat must be one of: ${VALID_CONTENT_FORMATS.join(', ')}`);
    }
    if (language && (typeof language !== 'string' || language.length > 10)) {
      errors.push('language must be a valid language code (e.g., "en", "es", "fr")');
    }
    if (gradeLevelLabel && (typeof gradeLevelLabel !== 'string' || gradeLevelLabel.length > 30)) {
      errors.push('gradeLevelLabel must be a short string such as "6" or "Grade 6"');
    }
    if (readingLexile !== undefined && (!Number.isInteger(readingLexile) || readingLexile < 0 || readingLexile > 2000)) {
      errors.push('readingLexile must be an integer between 0 and 2000');
    }
    if (supportFlags !== undefined && (typeof supportFlags !== 'object' || Array.isArray(supportFlags) || supportFlags === null)) {
      errors.push('supportFlags must be a JSON object');
    }
    if (recommendedProfilePatch !== undefined && (typeof recommendedProfilePatch !== 'object' || Array.isArray(recommendedProfilePatch) || recommendedProfilePatch === null)) {
      errors.push('recommendedProfilePatch must be a JSON object');
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Build update data — only include fields that were sent
    const updateData = {};
    if (readingLevel !== undefined) updateData.readingLevel = readingLevel;
    if (diagnosticReadingLevel !== undefined) updateData.diagnosticReadingLevel = diagnosticReadingLevel;
    if (gradeLevelLabel !== undefined) updateData.gradeLevelLabel = gradeLevelLabel;
    if (readingLexile !== undefined) updateData.readingLexile = readingLexile;
    if (mathLevel !== undefined) updateData.mathLevel = mathLevel;
    if (diagnosticMathLevel !== undefined) updateData.diagnosticMathLevel = diagnosticMathLevel;
    if (language !== undefined) updateData.language = language;
    if (bandwidthMode !== undefined) updateData.bandwidthMode = bandwidthMode;
    if (fontSize !== undefined) updateData.fontSize = fontSize;
    if (highContrast !== undefined) updateData.highContrast = Boolean(highContrast);
    if (dyslexiaFont !== undefined) updateData.dyslexiaFont = Boolean(dyslexiaFont);
    if (screenReaderMode !== undefined) updateData.screenReaderMode = Boolean(screenReaderMode);
    if (reducedMotion !== undefined) updateData.reducedMotion = Boolean(reducedMotion);
    if (preferredContentFormat !== undefined) updateData.preferredContentFormat = preferredContentFormat;
    if (supportFlags !== undefined) updateData.supportFlags = supportFlags;
    if (recommendedProfilePatch !== undefined) updateData.recommendedProfilePatch = recommendedProfilePatch;
    if (ttsEnabled !== undefined) updateData.ttsEnabled = Boolean(ttsEnabled);
    if (ttsProvider !== undefined) updateData.ttsProvider = ttsProvider;

    // Upsert — create if doesn't exist, update if it does
    const profile = await prisma.learnerProfile.upsert({
      where: { userId },
      update: updateData,
      create: { userId, ...updateData },
    });

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
