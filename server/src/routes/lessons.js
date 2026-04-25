const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const router = express.Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

router.post('/generate', async (req, res) => {
  const { standard } = req.body;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are an expert curriculum designer. Given this standard: "${standard}"
        
        Generate THREE differentiated lesson plans in JSON:
        - foundational: for students 1-2 grades below level
        - grade_level: for on-level students
        - advanced: for students ready for enrichment
        
        Each plan must include: title, objectives[], reading_passage, quiz (5 questions with answer key), discussion_prompts[].
        
        Return ONLY valid JSON, no markdown.`
      }]
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        res.write(`data: ${JSON.stringify(chunk.delta)}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;