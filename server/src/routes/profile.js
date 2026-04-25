const express = require('express');
const prisma = require('../lib/prisma');
const { protect } = require('../middleware/auth');
const router = express.Router();

// Valid enum values for server-side validation
const VALID_READING_LEVELS = ['FOUNDATIONAL', 'GRADE_LEVEL', 'ADVANCED'];
const VALID_BANDWIDTH_MODES = ['FULL', 'REDUCED', 'TEXT_ONLY'];
const VALID_FONT_SIZES = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'];
const VALID_TTS_PROVIDERS = ['ELEVENLABS', 'WEB_SPEECH'];

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
      language,
      bandwidthMode,
      fontSize,
      highContrast,
      dyslexiaFont,
      ttsEnabled,
      ttsProvider,
    } = req.body;

    // Validate enums
    const errors = [];

    if (readingLevel && !VALID_READING_LEVELS.includes(readingLevel)) {
      errors.push(`readingLevel must be one of: ${VALID_READING_LEVELS.join(', ')}`);
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
    if (language && (typeof language !== 'string' || language.length > 10)) {
      errors.push('language must be a valid language code (e.g., "en", "es", "fr")');
    }

    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    // Build update data — only include fields that were sent
    const updateData = {};
    if (readingLevel !== undefined) updateData.readingLevel = readingLevel;
    if (language !== undefined) updateData.language = language;
    if (bandwidthMode !== undefined) updateData.bandwidthMode = bandwidthMode;
    if (fontSize !== undefined) updateData.fontSize = fontSize;
    if (highContrast !== undefined) updateData.highContrast = Boolean(highContrast);
    if (dyslexiaFont !== undefined) updateData.dyslexiaFont = Boolean(dyslexiaFont);
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