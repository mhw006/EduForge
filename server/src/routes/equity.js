const express = require('express');
const router = express.Router();
const { requireTeacher } = require('../middleware/auth');
const { adaptContentForLearner } = require('../services/equity');

// ─── POST /api/equity/adapt ───────────────────────────────────────────────────
// Adapts a topic or lesson content for a specific learner profile.
// Handles language, reading level, accessibility, and bandwidth constraints.
router.post('/adapt', requireTeacher, async (req, res) => {
  const { topic, profile } = req.body;

  if (!topic || !topic.trim()) {
    return res.status(400).json({ error: 'topic is required' });
  }
  if (topic.length > 2000) {
    return res.status(400).json({ error: 'Topic must be under 2000 characters' });
  }

  try {
    const result = await adaptContentForLearner(topic, profile || {});
    res.json(result);
  } catch (err) {
    console.error('EduEquity /adapt error:', err);
    res.status(500).json({ error: 'Adaptation failed', detail: err.message });
  }
});

module.exports = router;
