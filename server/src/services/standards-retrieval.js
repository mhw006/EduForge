/**
 * Phase 2 — Standards-grounded prompting (lite RAG)
 *
 * Pragmatic ground-truth retrieval against a hand-curated corpus of Common
 * Core, NGSS, and C3 standards. NO embeddings yet — keyword scoring is
 * good enough for the demo and avoids needing OpenAI/Voyage credentials.
 *
 * Upgrade path to true vector RAG (post-hackathon):
 *   1. Enable pgvector extension on Supabase: CREATE EXTENSION vector;
 *   2. Add embedding column on a new `Standard` model: embedding vector(1536)
 *   3. Generate embeddings for fullText using OpenAI text-embedding-3-small
 *      or Voyage voyage-3 (cheaper) at ingest time
 *   4. Replace `searchStandards` body with: SELECT * FROM "Standard"
 *      ORDER BY embedding <-> $1::vector LIMIT $2
 *   5. Optionally use Anthropic's tool-use to let Claude call this as a tool
 *
 * The interface (findExactStandard, searchStandards, buildContextBlock) stays
 * identical — only the implementation changes.
 */
const fs = require('fs');
const path = require('path');

const STANDARDS = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'standards.json'), 'utf8')
);

const STANDARDS_BY_CODE = new Map(STANDARDS.map((s) => [s.code.toLowerCase(), s]));

/** Look up by exact code match (case-insensitive). */
function findExactStandard(code) {
  if (!code) return null;
  // Try exact code first
  const direct = STANDARDS_BY_CODE.get(String(code).trim().toLowerCase());
  if (direct) return direct;
  // Try to find a code embedded in the input string (e.g. "CCSS.ELA-LITERACY.RI.6.1 — Cite textual evidence")
  for (const s of STANDARDS) {
    if (code.toLowerCase().includes(s.code.toLowerCase())) return s;
  }
  return null;
}

/**
 * Score-based keyword search. Higher score = better match.
 *   +5 per exact code substring match
 *   +3 per keyword hit
 *   +2 per fullText word overlap (>3 chars)
 *   +1 per title word overlap (>3 chars)
 */
function searchStandards(query, limit = 5) {
  if (!query || !query.trim()) return [];

  const q = query.toLowerCase();
  const qWords = new Set(q.split(/\W+/).filter((w) => w.length > 3));

  const scored = STANDARDS.map((s) => {
    let score = 0;
    if (q.includes(s.code.toLowerCase())) score += 5;
    for (const k of s.keywords || []) {
      if (q.includes(k.toLowerCase())) score += 3;
    }
    const fullTextWords = s.fullText.toLowerCase().split(/\W+/);
    for (const w of fullTextWords) {
      if (w.length > 3 && qWords.has(w)) score += 2;
    }
    const titleWords = s.title.toLowerCase().split(/\W+/);
    for (const w of titleWords) {
      if (w.length > 3 && qWords.has(w)) score += 1;
    }
    return { standard: s, score };
  });

  return scored
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.standard);
}

/**
 * Build a "REFERENCE STANDARDS" block to inject into the LessonForge prompt.
 * Returns null if no standards matched (caller should fall back to plain prompt).
 *
 * Strategy:
 *   1. Try exact-code match → use that + its `related[]` standards
 *   2. Otherwise keyword-search → top 3 matches
 */
function buildContextBlock(input) {
  const exact = findExactStandard(input);
  let matches;

  if (exact) {
    matches = [exact];
    for (const relCode of exact.related || []) {
      const rel = findExactStandard(relCode);
      if (rel) matches.push(rel);
    }
    matches = matches.slice(0, 3);
  } else {
    matches = searchStandards(input, 3);
  }

  if (matches.length === 0) return null;

  const lines = matches.map((s, i) =>
    `[${i + 1}] ${s.code} (${s.subject} · grade ${s.gradeBand})\n    ${s.title}\n    "${s.fullText}"`
  );

  return [
    'REFERENCE STANDARDS (use these to ground your lesson — cite them where appropriate):',
    ...lines,
    '',
    `These standards are from a curated corpus. The PRIMARY standard for this lesson is [1]: ${matches[0].code}.`,
    `Related standards [2]+ are provided for cross-curricular awareness.`,
  ].join('\n');
}

module.exports = {
  STANDARDS,           // exposed for /api/standards/search route
  findExactStandard,
  searchStandards,
  buildContextBlock,
};
