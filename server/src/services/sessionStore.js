// In-memory session store keyed by sessionId.
// Suitable for hackathon — no persistence across server restarts.
const sessions = new Map();

function defaultProfile(sessionId) {
  return {
    educationLevel: 'high_school',
    readingLevel: 'intermediate',
    connectivityTier: 'medium',
    language: 'en',
    subject: '',
    grade: '',
    conceptsEncountered: [],
    conceptScores: {},
    diagnosticHistory: [],
    sessionId,
  };
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      userProfile: defaultProfile(sessionId),
      knowledgeState: { conceptsEncountered: [], conceptScores: {} },
      conversationHistory: [],
      diagnosticCompleted: false,
      preAdaptationProfile: null,
    });
  }
  return sessions.get(sessionId);
}

function updateUserProfile(sessionId, updates) {
  const session = getSession(sessionId);
  // Save the pre-adaptation snapshot on first diagnostic update
  if (updates._fromDiagnostic && !session.preAdaptationProfile) {
    session.preAdaptationProfile = { ...session.userProfile };
  }
  session.userProfile = { ...session.userProfile, ...updates };
  delete session.userProfile._fromDiagnostic;
  sessions.set(sessionId, session);
  return session;
}

function updateKnowledgeState(sessionId, { conceptsTouched = [], conceptScores = {} }) {
  const session = getSession(sessionId);

  const encountered = new Set(session.knowledgeState.conceptsEncountered);
  conceptsTouched.forEach((c) => encountered.add(c));
  session.knowledgeState.conceptsEncountered = [...encountered];
  session.userProfile.conceptsEncountered = [...encountered];

  session.knowledgeState.conceptScores = {
    ...session.knowledgeState.conceptScores,
    ...conceptScores,
  };
  session.userProfile.conceptScores = session.knowledgeState.conceptScores;

  sessions.set(sessionId, session);
  return session;
}

function appendMessage(sessionId, message) {
  const session = getSession(sessionId);
  session.conversationHistory.push(message);
  if (session.conversationHistory.length > 20) {
    session.conversationHistory = session.conversationHistory.slice(-20);
  }
  sessions.set(sessionId, session);
}

function markDiagnosticComplete(sessionId) {
  const session = getSession(sessionId);
  session.diagnosticCompleted = true;
  sessions.set(sessionId, session);
}

module.exports = {
  getSession,
  updateUserProfile,
  updateKnowledgeState,
  appendMessage,
  markDiagnosticComplete,
};
