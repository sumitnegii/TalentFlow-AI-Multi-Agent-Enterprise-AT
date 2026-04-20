const { callClaudeJSON } = require("../ai");

/**
 * Fairness Agent (embedded audit step)
 *
 * FIX: Was using callClaude (returns raw string). Switched to callClaudeJSON
 * so the return value is always a structured, parseable object.
 */
async function checkFairness(jdText, cvText, matchResult) {
  const systemPrompt = `
You are an AI Fairness Auditor embedded in the HR recruitment pipeline.
Ensure the process is free from explicit and implicit bias.

Tasks:
1. Examine if the JD contains biased or exclusionary language (e.g., gendered wording, unnecessary degree requirements).
2. Audit the match result: is the score based strictly on technical merit and stated requirements?
3. Flag any "hidden" biases (e.g., prestige-school preference over demonstrated skills).
4. Provide a Fairness Score (0-100).

Return ONLY valid JSON:
{
  "fairness_score": 0,
  "jd_bias_flags": ["flag1"],
  "match_bias_flags": ["flag2"],
  "overall_verdict": "Fair",
  "recommendations": ["recommendation1"]
}

Valid values for overall_verdict: "Fair", "Caution", "Biased"
`;

  return await callClaudeJSON(systemPrompt, `
JD Text:
${jdText}

CV Text:
${cvText}

Current Match Result:
${JSON.stringify(matchResult, null, 2)}
`);
}

module.exports = checkFairness;
