const { callClaudeJSON } = require("../ai");

/**
 * Agent 8: Ranking Engine (LLM-assisted version used by legacy /api/process route)
 *
 * FIX: Was using callClaude (returns raw string). The caller passes the result
 * to hrReview and reads ranking.top_recommendations, etc. Switched to callClaudeJSON
 * with an explicit output schema so the shape is guaranteed.
 *
 * NOTE: The new campaign pipeline (routes/api.js + routes/campaigns.js) uses a
 * native JS sort for ranking (faster, no API cost). This agent is kept for the
 * legacy stateless pipeline in routes/process.js.
 */
async function rankCandidates(candidatesData) {
  const systemPrompt = `
You are the AI Ranking Engine (Agent 8).
Rank the provided candidates by overall merit and fit for the role.
Group them into three tiers and justify the top 3 placements.

Return ONLY valid JSON:
{
  "top_recommendations": [
    { "fileName": "", "final_score": 0, "justification": "" }
  ],
  "qualified": [
    { "fileName": "", "final_score": 0 }
  ],
  "others": [
    { "fileName": "", "final_score": 0 }
  ],
  "summary": "Overall batch summary in 2-3 sentences."
}
`;

  return await callClaudeJSON(
    systemPrompt,
    `Candidates Data:\n${JSON.stringify(candidatesData, null, 2)}`
  );
}

module.exports = rankCandidates;
