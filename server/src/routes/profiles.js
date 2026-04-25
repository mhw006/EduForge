const express = require('express');
const { prisma } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const READING_LEVELS  = ['FOUNDATIONAL', 'GRADE_LEVEL', 'ADVANCED'];
const BANDWIDTH_MODES = ['FULL', 'REDUCED', 'TEXT_ONLY'];
const FONT_SIZES      = ['SMALL', 'MEDIUM', 'LARGE', 'XLARGE'];
const TTS_PROVIDERS   = ['ELEVENLABS', 'WEB_SPEECH'];

function pickProfileFields(body) {
  const data = {};
  if (READING_LEVELS.includes(body.readingLevel))   data.readingLevel  = body.readingLevel;
  if (BANDWIDTH_MODES.includes(body.bandwidthMode)) data.bandwidthMode = body.bandwidthMode;
  if (FONT_SIZES.includes(body.fontSize))           data.fontSize      = body.fontSize;
  if (TTS_PROVIDERS.includes(body.ttsProvider))     data.ttsProvider   = body.ttsProvider;
  if (typeof body.language     === 'string' && body.language.length <= 5) data.language     = body.language;
  if (typeof body.highContrast === 'boolean') data.highContrast = body.highContrast;
  if (typeof body.dyslexiaFont === 'boolean') data.dyslexiaFont = body.dyslexiaFont;
  if (typeof body.ttsEnabled   === 'boolean') data.ttsEnabled   = body.ttsEnabled;
  return data;
}

// GET /api/profiles/me — current user's profile (or null if none yet)
router.get('/me', requireAuth, async (req, res) => {
  const profile = await prisma.learnerProfile.findUnique({
    where: { userId: req.user.id },
  });
  res.json(profile);
});

// PUT /api/profiles/me — upsert current user's profile
router.put('/me', requireAuth, async (req, res) => {
  const data = pickProfileFields(req.body);

  const profile = await prisma.learnerProfile.upsert({
    where:  { userId: req.user.id },
    update: data,
    create: { userId: req.user.id, ...data },
  });

  res.json(profile);
});

module.exports = router;
