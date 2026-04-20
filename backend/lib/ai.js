const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
});

if (!process.env.CLAUDE_API_KEY) {
  console.error("ERROR: CLAUDE_API_KEY is not set in .env");
}

const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const TIMEOUT_MS = 60000; // 60 seconds per API call
const MAX_TOKENS = 4096;
const MODEL_CANDIDATES = [
  process.env.ANTHROPIC_MODEL,
  process.env.CLAUDE_MODEL,
  "claude-sonnet-4-20250514",
  "claude-3-7-sonnet-20250219",
  "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku-20241022",
].filter(Boolean);

/**
 * Core Claude call with timeout support.
 *
 * Uses the Messages API (anthropic.messages.create) which is required for all
 * Claude 3 models. The old completions API (anthropic.completions.create) was
 * only valid for Claude 2 and earlier — it will 404 on claude-3-5-sonnet.
 *
 * Requires @anthropic-ai/sdk >= 0.20 (Messages API). Package.json has been
 * updated to ^0.39.0 — run `npm install` after pulling this change.
 */
async function callClaude(systemPrompt, userPrompt) {
  let lastError;

  for (let model of MODEL_CANDIDATES) {
    // Intercept invalid model name from environment variables
    if (model === "claude-3-5-sonnet-latest") {
      model = "claude-3-5-sonnet-20241022";
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      console.log("[callClaude] Calling API with model:", model);
      const response = await anthropic.messages.create(
        {
          model,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        },
        { signal: controller.signal }
      );

      clearTimeout(timer);
      return response.content[0].text;
    } catch (error) {
      clearTimeout(timer);

      if (error.name === "AbortError") {
        throw new Error("Claude API call timed out after 60s.");
      }

      if (error.status === 429) {
        throw new Error("Claude API rate limit hit. Back off and retry.");
      }

      lastError = error;

      if (
        error.status === 404 ||
        error.error?.type === "not_found_error" ||
        /not[_ ]found|model:/i.test(error.message || "")
      ) {
        console.warn(`[callClaude] Model unavailable: ${model}`);
        continue;
      }

      console.error("[callClaude] API Error:", error.message);
      throw new Error(`Claude API failed: ${error.message}`);
    }
  }

  throw new Error(
    `Claude API failed: no configured Anthropic model was available. Last error: ${lastError?.message || "unknown error"}`
  );
}

/**
 * Claude call that guarantees a parsed JSON object is returned.
 *
 * FIX (original bug): The regex was /\\{.*\\}/s — double-escaped backslashes
 * inside a regex literal match literal \{...\}, never actual JSON braces.
 * Corrected to /\{[\s\S]*\}/ and /\[[\s\S]*\]/.
 *
 * Retries up to `maxRetries` times with exponential backoff (1 s, 2 s, …).
 */
async function callClaudeJSON(systemPrompt, userPrompt, maxRetries = 2) {
  const strictSystem = `${systemPrompt}

CRITICAL RULE: Return ONLY raw valid JSON. No markdown code fences, no triple backticks, no introductory sentence, no trailing explanation. Your entire response must start with { or [ and end with } or ].`;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s…
      console.warn(`[callClaudeJSON] Retry ${attempt}/${maxRetries} in ${delay}ms…`);
      await new Promise((r) => setTimeout(r, delay));
    }

    try {
      const raw = await callClaude(strictSystem, userPrompt);

      // Strip markdown code fences in case Claude still wraps the response
      const stripped = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      // Extract outermost JSON object or array
      const objMatch = stripped.match(/\{[\s\S]*\}/);
      const arrMatch = stripped.match(/\[[\s\S]*\]/);
      const jsonStr = objMatch ? objMatch[0] : arrMatch ? arrMatch[0] : stripped;

      return JSON.parse(jsonStr);
    } catch (err) {
      lastError = err;
      console.error(`[callClaudeJSON] Attempt ${attempt + 1} failed:`, err.message);
    }
  }

  throw new Error(
    `Agent returned invalid JSON after ${maxRetries + 1} attempts. Last error: ${lastError.message}`
  );
}

module.exports = { callClaude, callClaudeJSON };
