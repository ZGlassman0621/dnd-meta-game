/**
 * LLM Client - Ollama API Integration
 *
 * Low-level client for communicating with the locally running Ollama instance.
 * Provides chat, status checking, and model listing.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss:20b';

/**
 * Check if Ollama is running AND the configured model is installed.
 *
 * v1.0.102 — extends the previous "is /api/tags reachable" check to also
 * verify the configured `OLLAMA_MODEL` (default `gpt-oss:20b`) is in the
 * installed-models list. Without this, a system with Ollama running but
 * the configured model NOT pulled would auto-fallback into a doomed
 * chat call that fails with a model-not-found error. Now it fails fast
 * with a specific message at status-check time.
 *
 * Distinguishes:
 *   • Reachable + model installed → `{ available: true }`
 *   • Reachable + model missing → `{ available: false, error_code: 'no_model', ... }`
 *   • Unreachable → `{ available: false, error_code: 'unreachable', ... }`
 *
 * `getLLMProvider` upstream treats any `available: false` as "skip Ollama,"
 * so the auto-fallback path no longer routes a doomed call. The distinct
 * `error_code` lets the status indicator render an actionable message
 * ("pull gpt-oss:20b") rather than a generic "Ollama not running."
 */
export async function checkOllamaStatus() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      return {
        available: false,
        error_code: 'unreachable',
        error: `Ollama responded with HTTP ${response.status}`
      };
    }

    const data = await response.json();
    const models = data.models || [];
    const installed = models.some(m => m.name === DEFAULT_MODEL || m.model === DEFAULT_MODEL);

    if (!installed) {
      return {
        available: false,
        error_code: 'no_model',
        error: `Ollama is running but the configured model "${DEFAULT_MODEL}" is not installed. Run \`ollama pull ${DEFAULT_MODEL}\` or set OLLAMA_MODEL in .env to one of the installed models.`,
        models,
        configured_model: DEFAULT_MODEL,
        url: OLLAMA_BASE_URL
      };
    }

    return {
      available: true,
      models,
      configured_model: DEFAULT_MODEL,
      url: OLLAMA_BASE_URL
    };
  } catch (error) {
    return {
      available: false,
      error_code: 'unreachable',
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
