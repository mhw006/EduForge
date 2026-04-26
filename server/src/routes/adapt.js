const express = require('express');
const router = express.Router();
const { adaptLesson } = require('../middleware/eduequity');
const { generateAudio } = require('../services/elevenlabs');
const { requireAuth } = require('../middleware/auth');

// GET /api/adapt/:lessonId — Returns adapted lesson for the authenticated student
router.get('/:lessonId', requireAuth, adaptLesson, (req, res) => {
  res.json(req.adaptedLesson);
});

// POST /api/adapt/:lessonId/audio — Generate or retrieve cached TTS audio
router.post('/:lessonId/audio', requireAuth, adaptLesson, async (req, res) => {
  const { lessonId } = req.params;
  const { content, appliedProfile } = req.adaptedLesson;

  if (appliedProfile.ttsProvider === 'WEB_SPEECH') {
    return res.json({ provider: 'WEB_SPEECH', text: content.mainContent });
  }

  try {
    const { url: audioUrl } = await generateAudio(
      lessonId,
      appliedProfile.readingLevel,
      appliedProfile.language,
      content,
      req.user.id
    );
    res.json({ provider: 'ELEVENLABS', audioUrl });
  } catch (err) {
    console.error('ElevenLabs TTS failed, falling back to Web Speech:', err.message);
    res.json({ provider: 'WEB_SPEECH', text: content.mainContent, fallback: true });
  }
});

module.exports = router;
