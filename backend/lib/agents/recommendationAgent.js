const { callClaudeJSON } = require("../ai");

/**
 * Candidate Recommendation Agent
 *
 * Analyzes the top candidates for a role and produces a structured hiring
 * recommendation — who to hire, why, and what risks to consider.
 *
 * Returns:
 * {
 *   recommended_candidate: "<name>",
 *   recommended_id: "<id>",
 *   confidence: "HIGH" | "MEDIUM" | "LOW",
 *   headline: "<one-liner recommendation>",
 *   reasons: ["<reason 1>", ...],
 *   risks: ["<risk 1>", ...],
 *   runner_up: "<name of second best>",
 *   runner_up_id: "<id>",
 *   runner_up_note: "<brief note>",
 *   comparison_note: "<why top > runner_up>"
 * }
 */
async function generateRecommendation({ candidates, jobTitle, jdRequirements }) {
  const systemPrompt = `
You are the Chairman of the AI Hiring Board. Based on the candidate evaluation data provided by the Board Specialists,
give a clear hiring recommendation for the role.

Rules:
- Be decisive. Pick ONE top candidate and justify it clearly.
- Identify real risks (not generic ones).
- If no candidate is strong enough (all scores < 60), say so.
- Return ONLY valid JSON.

Return EXACTLY this structure:
{
  "recommended_candidate": "<full name or filename>",
  "recommended_id": "<candidate _id string>",
  "confidence": "HIGH",
  "headline": "<one compelling sentence recommending hire>",
  "reasons": ["<specific reason 1>", "<specific reason 2>", "<specific reason 3>"],
  "risks": ["<potential concern 1>", "<potential concern 2>"],
  "runner_up": "<second best candidate name>",
  "runner_up_id": "<second best _id>",
  "runner_up_note": "<why runner up is second choice>",
  "comparison_note": "<what differentiates recommend over runner_up>"
}
`;

  const candidateSummaries = candidates.map((c) => ({
    id: c._id?.toString(),
    name: c.parsed_data?.full_name || c.fileName,
    final_score: c.final_score,
    final_decision: c.final_decision,
    rank: c.rank,
    top_skills: (c.validated_skills?.top_skills || []).slice(0, 8).map((s) =>
      typeof s === "string" ? s : s.name
    ),
    years_experience: c.parsed_data?.years_experience,
    debate_summary: c.debate_summary?.slice(0, 200),
    hr_note: c.hr_note?.slice(0, 200),
    strengths: (c.match_results?.strengths || []).slice(0, 3),
    weaknesses: (c.match_results?.weaknesses || []).slice(0, 3),
  }));

  const userPrompt = `
Role: ${jobTitle}
JD Requirements: ${JSON.stringify(jdRequirements)}

Top Candidates (sorted by AI score):
${JSON.stringify(candidateSummaries, null, 2)}

Select the best hire and explain your reasoning.
`;

  return await callClaudeJSON(systemPrompt, userPrompt);
}

module.exports = generateRecommendation;
