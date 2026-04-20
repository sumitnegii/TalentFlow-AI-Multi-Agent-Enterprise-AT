const { callClaudeJSON } = require("../ai");

/**
 * Agent 5: Match Engine
 */
async function matchEngine(validatedSkills, jdMetrics) {
  const systemPrompt = `
You are the Match Engine (Agent 5) in a corporate ATS.
Compare the candidate's Blind Capability Analysis against the JD Metrics and Scoring Rubric provided by Agent 2.

CALCULATION PROTOCOL:
1. COMPONENT WEIGHTS: Use the weightages defined in JD Metrics (Skills vs Experience vs Projects).
2. DEALBREAKER CHECK: If a candidate fails a "Dealbreaker" from JD Metrics, the final score CANNOT exceed 40, regardless of other strengths.
3. RUBRIC ADHERENCE: Use the "scoring_rubric" from JD Metrics to anchor your numbers.
4. EVIDENCE-BASED: For every score component, you MUST provide a "rationale" explaining why that specific number was chosen.

Return ONLY valid JSON:
{
  "match_score": 0,
  "component_breakdown": {
    "skill_match": { "score": 0, "max": 0, "rationale": "" },
    "experience_match": { "score": 0, "max": 0, "rationale": "" },
    "project_alignment": { "score": 0, "max": 0, "rationale": "" }
  },
  "dealbreaker_status": { "passed": true, "failures": [] },
  "key_differentiators": ["What makes this candidate stand out?"],
  "missing_critical_skills": []
}

IMPORTANT: "match_score" must be the weighted sum of the components.
`;

  const userInput = `
JD Metrics (incl. Rubric):
${JSON.stringify(jdMetrics, null, 2)}

Validated Candidate Capabilities:
${JSON.stringify(validatedSkills, null, 2)}
`;

  return await callClaudeJSON(systemPrompt, userInput);
}

module.exports = matchEngine;
