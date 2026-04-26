const READING_INSTRUCTIONS = {
  basic: 'Use very short sentences. No jargon. Flesch-Kincaid grade 5 target. Use everyday analogies. Never use technical terms without immediately explaining them in plain language.',
  intermediate: 'Use moderate complexity. Introduce technical terms with brief inline definitions. Paragraphs of 3-4 sentences.',
  advanced: 'Use full technical vocabulary. Assume domain familiarity. Engage with edge cases and nuance.',
};

const EDUCATION_INSTRUCTIONS = {
  middle_school: 'Use relatable examples from everyday life — sports, food, games, social situations. Avoid abstraction. Make everything concrete.',
  high_school: 'Balance conceptual explanation with real-world application. Occasional abstraction is okay if grounded.',
  community_college: 'Treat the student as a capable adult returning to education. Be encouraging without being patronizing.',
  university: 'Engage with theory, edge cases, first principles, and deeper reasoning. Cite relevant frameworks.',
};

const CONNECTIVITY_INSTRUCTIONS = {
  low: 'CRITICAL: Your response must be under 100 words total. Use zero markdown. No bullet points, no bold, no headers. Plain text only. One short paragraph maximum. Pretend this is an SMS message.',
  medium: 'Keep responses under 250 words. Light markdown is acceptable. One or two bullet points maximum.',
  high: 'Full rich responses allowed. Use markdown, code blocks, structured lists, and detailed explanations freely.',
};

function buildSystemPrompt(userProfile, knowledgeState) {
  const profile = userProfile || {};
  const ks = knowledgeState || {};

  const readingInstructions =
    READING_INSTRUCTIONS[profile.readingLevel] ||
    READING_INSTRUCTIONS.intermediate;

  const educationInstructions =
    EDUCATION_INSTRUCTIONS[profile.educationLevel] ||
    EDUCATION_INSTRUCTIONS.high_school;

  const connectivityInstructions =
    CONNECTIVITY_INSTRUCTIONS[profile.connectivityTier] ||
    CONNECTIVITY_INSTRUCTIONS.medium;

  const encountered = Array.isArray(ks.conceptsEncountered) ? ks.conceptsEncountered : [];
  const scores = ks.conceptScores || {};

  const strong = Object.entries(scores)
    .filter(([, v]) => v > 0.7)
    .map(([k]) => k);
  const struggling = Object.entries(scores)
    .filter(([, v]) => v < 0.4)
    .map(([k]) => k);

  const knowledgeContext =
    encountered.length > 0
      ? `The student has previously encountered: ${encountered.join(', ')}. Strong understanding of: ${strong.join(', ') || 'nothing yet'}. Struggling with: ${struggling.join(', ') || 'nothing identified yet'}.`
      : "This is the student's first session.";

  return `You are EduForge, an equity-aware AI tutor. You adapt your teaching style to the specific needs and constraints of each student.

STUDENT PROFILE:
- Education level: ${profile.educationLevel || 'high_school'}
- Reading level: ${profile.readingLevel || 'intermediate'}
- Connection/device tier: ${profile.connectivityTier || 'medium'}
- Subject: ${profile.subject || 'General'}

READING LEVEL INSTRUCTIONS: ${readingInstructions}

EDUCATION LEVEL INSTRUCTIONS: ${educationInstructions}

CONNECTIVITY INSTRUCTIONS: ${connectivityInstructions}

KNOWLEDGE STATE: ${knowledgeContext}

Always teach with patience and without assumption. Never make the student feel behind. Your goal is understanding, not coverage.`;
}

// Returns a summary of what changed between two profiles (for adaptation banner)
function describeAdaptation(before, after) {
  const changes = [];
  if (before.readingLevel !== after.readingLevel) {
    const labels = { basic: 'Simple', intermediate: 'Intermediate', advanced: 'Advanced' };
    changes.push(`Reading level detected: ${labels[after.readingLevel] || after.readingLevel}`);
  }
  if (before.connectivityTier !== after.connectivityTier) {
    const labels = { low: 'Low bandwidth (text-only)', medium: 'Standard', high: 'Full media' };
    changes.push(`Connection mode: ${labels[after.connectivityTier] || after.connectivityTier}`);
  }
  if (before.educationLevel !== after.educationLevel) {
    const labels = { middle_school: 'Middle School', high_school: 'High School', community_college: 'Community College', university: 'University' };
    changes.push(`Education context: ${labels[after.educationLevel] || after.educationLevel}`);
  }
  return changes;
}

module.exports = { buildSystemPrompt, describeAdaptation };
