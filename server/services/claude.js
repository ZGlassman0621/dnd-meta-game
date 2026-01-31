/**
 * Claude API Service - Cloud LLM Integration for AI Dungeon Master
 *
 * Uses Anthropic's Claude API for high-quality text adventure DM sessions.
 * Requires ANTHROPIC_API_KEY environment variable.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

/**
 * Check if Claude API is available (API key is set)
 */
export function isClaudeAvailable() {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Check Claude API status
 */
export async function checkClaudeStatus() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      available: false,
      error: 'ANTHROPIC_API_KEY not set in environment'
    };
  }

  // Try a minimal API call to verify the key works
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });

    if (response.ok) {
      return {
        available: true,
        model: DEFAULT_MODEL,
        provider: 'Anthropic Claude'
      };
    } else {
      const error = await response.json();
      return {
        available: false,
        error: error.error?.message || 'Claude API error'
      };
    }
  } catch (error) {
    return {
      available: false,
      error: `Cannot connect to Claude API: ${error.message}`
    };
  }
}

/**
 * Clean up AI response by removing meta-commentary that shouldn't be shown to players
 */
function cleanupResponse(text) {
  if (!text) return text;

  let cleaned = text
    .replace(/\n*\(Note:[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\(This (?:scene |establishes|is the beginning)[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\[Note:[\s\S]*?\]\.?\s*$/gi, '')
    .replace(/\n+Note:.*$/gi, '')
    .replace(/\n*\*+(?:Note|DM|Behind the scenes)[\s\S]*?\*+\.?\s*$/gi, '');

  return cleaned.trim();
}

/**
 * Send a message to Claude and get a response
 * Includes retry logic for transient network errors
 */
export async function chat(systemPrompt, messages, maxRetries = 3) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set');
  }

  // Convert messages to Claude format (separate system prompt)
  const claudeMessages = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));

  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          max_tokens: 2000,
          system: systemPrompt,
          messages: claudeMessages
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Claude API error: ${error.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '';

      return cleanupResponse(content);
    } catch (error) {
      lastError = error;

      // Check if it's a retryable network error
      const isNetworkError = error.cause?.code === 'UND_ERR_SOCKET' ||
                             error.message?.includes('fetch failed') ||
                             error.message?.includes('socket') ||
                             error.message?.includes('ECONNRESET');

      if (isNetworkError && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = Math.pow(2, attempt - 1) * 1000;
        console.log(`Claude API network error (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  throw lastError;
}

/**
 * Start a new DM session with Claude
 */
export async function startSession(systemPrompt, openingPrompt) {
  const messages = [{ role: 'user', content: openingPrompt }];
  const response = await chat(systemPrompt, messages);

  return {
    response,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: openingPrompt },
      { role: 'assistant', content: response }
    ]
  };
}

/**
 * Continue a session with Claude
 */
export async function continueSession(systemPrompt, messages, playerAction) {
  const updatedMessages = [
    ...messages.filter(m => m.role !== 'system'),
    { role: 'user', content: playerAction }
  ];

  const response = await chat(systemPrompt, updatedMessages);

  return {
    response,
    messages: [
      { role: 'system', content: systemPrompt },
      ...updatedMessages,
      { role: 'assistant', content: response }
    ]
  };
}

/**
 * Generate a session summary with Claude
 */
export async function generateSessionSummary(systemPrompt, messages) {
  const summaryMessages = [
    ...messages.filter(m => m.role !== 'system'),
    {
      role: 'user',
      content: `The session is ending. As the DM, provide a summary of this adventure session. Include:

1. KEY EVENTS: What major things happened? (2-3 sentences)
2. CURRENT STATE: Where is the party right now? What time of day/night is it in-game?
3. NEXT PLANS: What specific plans did the party make for their next move? Include ANY timing details (e.g., "agreed to leave at dawn", "will depart before sunrise", "meeting someone at midnight"). This is CRITICAL for the next session.
4. UNRESOLVED THREADS: Any mysteries, promises, or dangers left hanging?

Write in past tense as a narrative recap. Be specific about any timing or plans the party agreed to - the next session will start from exactly where this one ended.`
    }
  ];

  return await chat(systemPrompt, summaryMessages);
}

export default {
  isClaudeAvailable,
  checkClaudeStatus,
  chat,
  startSession,
  continueSession,
  generateSessionSummary
};
