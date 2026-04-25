require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function test() {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello! Reply with "API key works!"' }],
    });
    
    console.log('✅ API Key works!');
    console.log('Response:', message.content[0].text);
  } catch (error) {
    console.error('❌ API Key failed:', error.message);
  }
}

test();