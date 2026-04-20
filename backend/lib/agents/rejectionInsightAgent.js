const { callClaudeJSON } = require("../ai");

/**
 * Rejection Insight Agent
 *
 * Generates a human-readable explanation of why a candidate was rejected or
 * is borderline, based on their scores, debate summary, and skill gaps.
 *
 * Returns:
 * {
 *   headline: "<short 1-line reason>",
 *   reasons: ["<reason 1>", "<reason 2>", ...],
 *   skill_gaps: ["<gap 1>", ...],
 *   what_would_help: "<advice for candidate to improve>",
 *   reconsider_if: "<condition under which they'd be reconsidered>"
 * }
 */
async function generateRejectionInsight({
  candidateName,
  finalScore,
  finalDecision,
  debateSummary,
  hrNote,
  matchResults,
  validatedSkills,
  jdRequirements,
  jobTitle,
}) {
  const systemPrompt = `
You are a Feedback Coordinator on the AI Hiring Board. Explain clearly and specifically based on the board's findings why 
this candidate was not selected for the role.

Be constructive — give concrete skill gaps, not vague statements.
Do NOT be harsh. Frame it professionally and helpfully.

Return ONLY valid JSON with this exact structure:
{
  "headline": "<one sentence summary of the main rejection reason>",
  "reasons": ["<specific reason 1>", "<specific reason 2>", "<specific reason 3>"],
  "skill_gaps": ["<missing skill 1>", "<missing skill 2>"],
  "what_would_help": "<concrete advice on what would make them qualified>",
  "reconsider_if": "<optional: condition that would change the decision>"
}
`;

  const userPrompt = `
Candidate: ${candidateName}
Role: ${jobTitle}
Final Decision: ${finalDecision}
Final Score: ${finalScore}/100
AI Debate Summary: ${debateSummary || "Not available"}
HR Note: ${hrNote || "Not available"}

Candidate's Top Skills: ${JSON.stringify(validatedSkills)}
JD Required Skills: ${JSON.stringify(jdRequirements)}
Match Weaknesses: ${JSON.stringify(matchResults?.weaknesses || [])}

Explain why this candidate was ${finalDecision === "NO" ? "rejected" : "flagged as borderline"}.
`;

  return await callClaudeJSON(systemPrompt, userPrompt);
}

module.exports = generateRejectionInsight;
