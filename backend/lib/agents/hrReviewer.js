const { callClaudeJSON } = require("../ai");

/**
 * Agent 9: HR Final Review
 */
async function hrReview(candidate, jdMetrics) {
  const systemPrompt = `
You are a Executive HR Director (Agent 9) at a top-tier tech firm.
Synthesize the entire multi-agent evaluation into a professional, high-impact hiring note.

CRITICAL INSTRUCTIONS:
- Tone: Professional, decisive, and human-like.
- Focus: Highlight the specific justification for the decision (from Agent 6+7 debate) and the candidate's core value proposition.
- Length: 2-3 concise but informative sentences.

Return ONLY valid JSON:
{
  "summary_note": "..."
}
`;

  return await callClaudeJSON(systemPrompt, `JD Context:\n${JSON.stringify(jdMetrics)}\n\nCandidate Final Profile:\n${JSON.stringify(candidate)}`);
}

module.exports = hrReview;
