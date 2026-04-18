/**
 * LLM Client - Ollama API Integration
 *
 * Low-level client for communicating with the locally running Ollama instance.
 * Provides chat, status checking, and model listing.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';

/**
 * Check if Ollama is running and available
 */
export async function checkOllamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      return {
        available: true,
        models: data.models || [],
        url: OLLAMA_BASE_URL
      };
    }
    return { available: false, error: 'Ollama not responding' };
  } catch (error) {
    return {
      available: false,
      error: `Cannot connect to Ollama at ${OLLAMA_BASE_URL}. Make sure Ollama is running.`
    };
  }
}

/**
 * Strip reasoning/thinking tokens emitted by models like DeepSeek R1, QwQ, etc.
 * Removes <think>...</think> blocks (and similar) so players never see chain-of-thought.
 */
function stripThinkingTokens(text) {
  if (!text) return text;
  let out = text
    .replace(/<think>[\s\S]*?<\/think>\s*/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>\s*/gi, '')
    .replace(/<reasoning>[\s\S]*?<\/reasoning>\s*/gi, '');
  // Handle orphan opening tags (response truncated mid-thought) or orphan closing tags
  // by stripping from the open tag to end, or from start to the close tag.
  if (/<\/think>/i.test(out) && !/<think>/i.test(out)) {
    out = out.replace(/^[\s\S]*?<\/think>\s*/i, '');
  }
  if (/<think>/i.test(out) && !/<\/think>/i.test(out)) {
    out = out.replace(/<think>[\s\S]*$/i, '');
  }
  return out;
}

/**
 * Clean up AI response by removing meta-commentary that shouldn't be shown to players
 */
function cleanupResponse(text) {
  if (!text) return text;

  let cleaned = stripThinkingTokens(text)
    .replace(/\n*\(Note:[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\(This (?:scene |establishes|is the beginning)[\s\S]*?\)\.?\s*$/gi, '')
    .replace(/\n*\[Note:[\s\S]*?\]\.?\s*$/gi, '')
    .replace(/\n+Note:.*$/gi, '')
    .replace(/\n*\*+(?:Note|DM|Behind the scenes)[\s\S]*?\*+\.?\s*$/gi, '');

  return cleaned.trim();
}

/**
 * Send a message to Ollama and get a response
 */
export async function chat(messages, model = DEFAULT_MODEL) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 1000
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error: ${error}`);
  }

  const data = await response.json();
  return cleanupResponse(data.message?.content || '');
}

/**
 * List available models from Ollama
 */
export async function listModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (response.ok) {
      const data = await response.json();
      return data.models || [];
    }
    return [];
  } catch {
    return [];
  }
}

export default {
  checkOllamaStatus,
  chat,
  listModels
};
