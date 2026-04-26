/**
 * Phase 2 — Curriculum standards search (RAG corpus access)
 *
 * Public read-only endpoint over the curated standards corpus.
 * No auth required — these are published curriculum standards.
 */
const express = require('express');
const { searchStandards, findExactStandard, STANDARDS } = require('../services/standards-retrieval');

const router = express.Router();

// GET /api/standards/search?q=…&limit=…
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 8, 25);

  if (!q) {
    // Empty query → return a small sampler so the autocomplete has something
    return res.json({ standards: STANDARDS.slice(0, limit) });
  }

  const exact = findExactStandard(q);
  if (exact) return res.json({ standards: [exact] });

  const results = searchStandards(q, limit);
  res.json({ standards: results });
});

// GET /api/standards/:code — fetch full text by code
router.get('/:code', (req, res) => {
  const s = findExactStandard(req.params.code);
  if (!s) return res.status(404).json({ error: 'Standard not found' });
  res.json(s);
});

module.exports = router;
