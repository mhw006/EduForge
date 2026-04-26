const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { requireAuth } = require('../middleware/auth');
const { buildSystemPrompt, describeAdaptation } = require('../services/promptBuilder');
const {
  getSession,
  updateUserProfile,
  updateKnowledgeState,
  appendMessage,
  markDiagnosticComplete,
} = require('../services/sessionStore');

const router = express.Router();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.LESSONFORGE_MODEL || 'claude-sonnet-4-5-20250929';

// POST /api/chat — main student tutoring endpoint
// Accepts: { message, sessionId, userProfile? }
// Returns: { reply, knowledgeUpdate, knowledgeState, userProfile }
router.post('/', requireAuth, async (req, res) => {
  const { message, sessionId, userProfile: profileOverride } = req.body;

  if (!message || !sessionId) {
    return res.status(400).json({ error: 'message and sessionId are required' });
  }

  if (profileOverride) {
    updateUserProfile(sessionId, profileOverride);
  }

  const session = getSession(sessionId);
  const { userProfile, knowledgeState, conversationHistory } = session;
  const systemPrompt = buildSystemPrompt(userProfile, knowledgeState);

  appendMessage(sessionId, { role: 'user', content: message });

  try {
    // First Claude call: equity-aware tutoring response
    const mainResponse = await client.messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: systemPrompt,
      messages: [
        ...conversationHistory.slice(-10),
        { role: 'user', content: message },
      ],
    });

    const assistantReply = mainResponse.content[0].text;
    appendMessage(sessionId, { role: 'assistant', content: assistantReply });

    // Second Claude call: structured knowledge state extraction
    let knowledgeUpdate = null;
    try {
      const knowledgeResponse = await client.messages.create({
        model: MODEL,
        max_tokens: 300,
        system: 'You are a learning analytics system. Return ONLY valid JSON with no other text or markdown.',
        messages: [
          {
            role: 'user',
            content: `Student message: "${message}"\nTutor reply: "${assistantReply.slice(0, 400)}"\n\nReturn ONLY: { "conceptsTouched": ["string"], "understood": boolean, "struggleArea": "string | null", "difficultyAdjustment": "increase" | "decrease" | "maintain", "suggestedNextConcept": "string" }`,
          },
        ],
      });

      const rawJson = knowledgeResponse.content[0].text
        .replace(/```json\n?|\n?```/g, '')
        .trim();
      knowledgeUpdate = JSON.parse(rawJson);

      if (knowledgeUpdate.conceptsTouched?.length > 0) {
        const scoreUpdates = {};
        knowledgeUpdate.conceptsTouched.forEach((concept) => {
          const existing = knowledgeState.conceptScores[concept] ?? 0.5;
          scoreUpdates[concept] = knowledgeUpdate.understood
            ? Math.min(1.0, existing + 0.15)
            : Math.max(0.0, existing - 0.1);
        });
        updateKnowledgeState(sessionId, {
          conceptsTouched: knowledgeUpdate.conceptsTouched,
          conceptScores: scoreUpdates,
        });
      }
    } catch {
      // Knowledge extraction is non-critical — never fail the main response
    }

    const updated = getSession(sessionId);

    res.json({
      reply: assistantReply,
      knowledgeUpdate,
      knowledgeState: updated.knowledgeState,
      userProfile: updated.userProfile,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/chat/profile — update session profile (onboarding or post-diagnostic)
router.post('/profile', requireAuth, (req, res) => {
  const { sessionId, userProfile } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  updateUserProfile(sessionId, userProfile || {});
  const session = getSession(sessionId);
  res.json({ userProfile: session.userProfile, knowledgeState: session.knowledgeState });
});

// GET /api/chat/session/:sessionId — retrieve current session state
router.get('/session/:sessionId', requireAuth, (req, res) => {
  const session = getSession(req.params.sessionId);
  res.json({
    userProfile: session.userProfile,
    knowledgeState: session.knowledgeState,
    messageCount: session.conversationHistory.length,
    diagnosticCompleted: session.diagnosticCompleted,
    preAdaptationProfile: session.preAdaptationProfile,
  });
});

// POST /api/chat/diagnostic — Claude-powered quick diagnostic
// Accepts: { sessionId, subject, grade, readingPreference, connectivity }
// Returns: { readingLevelEstimate, connectivityTierEstimate, educationLevelEstimate,
//            conceptGaps, conceptStrengths, recommendedDifficulty, adaptationReason,
//            profileUpdates, adaptationChanges, userProfile }
router.post('/diagnostic', requireAuth, async (req, res) => {
  const { sessionId, subject, grade, readingPreference, connectivity } = req.body;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  const session = getSession(sessionId);
  const beforeProfile = { ...session.userProfile };

  try {
    const diagnosticPrompt = `You are an educational diagnostic AI. A student answered an onboarding questionnaire. Infer their learning profile.

Student information:
- Subject they are studying: ${subject || 'General'}
- Grade: ${grade || 'Unknown'}
- Reading preference self-report: "${readingPreference || 'some detail is fine'}"
- Device/connection self-report: "${connectivity || 'decent connection'}"

Map reading preference to: "basic" (simple/short) | "intermediate" (some detail) | "advanced" (full picture)
Map connectivity to: "low" (old phone/slow) | "medium" (decent) | "high" (fast laptop/wifi)
Infer education level from grade: K-8 = middle_school, 9-12 = high_school, college = community_college/university

Return ONLY valid JSON:
{
  "readingLevelEstimate": "basic" | "intermediate" | "advanced",
  "connectivityTierEstimate": "low" | "medium" | "high",
  "educationLevelEstimate": "middle_school" | "high_school" | "community_college" | "university",
  "conceptGaps": ["string"],
  "conceptStrengths": ["string"],
  "recommendedDifficulty": "foundational" | "grade_level" | "advanced",
  "adaptationReason": "string — one sentence explaining the key adaptation"
}`;

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: 'Return ONLY valid JSON with no other text or markdown.',
      messages: [{ role: 'user', content: diagnosticPrompt }],
    });

    const rawJson = response.content[0].text.replace(/```json\n?|\n?```/g, '').trim();
    const result = JSON.parse(rawJson);

    updateUserProfile(sessionId, {
      _fromDiagnostic: true,
      readingLevel: result.readingLevelEstimate,
      connectivityTier: result.connectivityTierEstimate,
      educationLevel: result.educationLevelEstimate,
      subject: subject || session.userProfile.subject,
      grade: grade || session.userProfile.grade,
    });
    markDiagnosticComplete(sessionId);

    const updated = getSession(sessionId);
    const adaptationChanges = describeAdaptation(beforeProfile, updated.userProfile);

    res.json({
      ...result,
      profileUpdates: {
        readingLevel: result.readingLevelEstimate,
        connectivityTier: result.connectivityTierEstimate,
        educationLevel: result.educationLevelEstimate,
      },
      adaptationChanges,
      userProfile: updated.userProfile,
    });
  } catch (err) {
    // Fallback: return sensible defaults so demo never crashes
    const fallback = {
      readingLevelEstimate: 'intermediate',
      connectivityTierEstimate: 'medium',
      educationLevelEstimate: 'high_school',
      conceptGaps: [],
      conceptStrengths: [],
      recommendedDifficulty: 'grade_level',
      adaptationReason: 'Profile estimated from self-report answers.',
    };
    updateUserProfile(sessionId, {
      _fromDiagnostic: true,
      readingLevel: fallback.readingLevelEstimate,
      connectivityTier: fallback.connectivityTierEstimate,
      educationLevel: fallback.educationLevelEstimate,
      subject: subject || '',
      grade: grade || '',
    });
    markDiagnosticComplete(sessionId);

    const updated = getSession(sessionId);
    const adaptationChanges = describeAdaptation(beforeProfile, updated.userProfile);

    res.json({
      ...fallback,
      profileUpdates: {
        readingLevel: fallback.readingLevelEstimate,
        connectivityTier: fallback.connectivityTierEstimate,
        educationLevel: fallback.educationLevelEstimate,
      },
      adaptationChanges,
      userProfile: updated.userProfile,
      _fallback: true,
    });
  }
});

module.exports = router;
