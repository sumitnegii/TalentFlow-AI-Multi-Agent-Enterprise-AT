const { callClaudeJSON } = require("../ai");

/**
 * Agent 4: Counter Agent
 *
 * FIX: Was using callClaude (returns raw string). The caller reads
 * evaluation.match_score, evaluation.skills_gap, evaluation.fairness_status, etc.
 * All of those would be undefined on a string. Switched to callClaudeJSON.
 */
async function counterAgentEvaluation(jdAnalysis, cvAnalysis) {
  const systemPrompt = `
You are the Counter Agent (Agent 4) in an AI Recruitment pipeline.
Critically evaluate whether the candidate's CV profile genuinely meets the JD requirements.
Act as a skeptical auditor — challenge buzzwords, surface gaps, ensure fairness.

Tasks:
1. Challenge the Fit: Does the candidate's experience actually map to the JD, or are they keyword-stuffing?
2. Bias Audit: Is the CV-to-JD mapping purely merit-based? Flag any implicit bias.
3. Compute Match Score (0-100) with heavy penalties for missing must-have skills.
4. List explicitly missing skills.


Return ONLY valid JSON:
{
  "match_score": 0,
  "critical_analysis": "short paragraph challenging the fit",
  "fairness_status": "Clean",
  "skills_gap": ["skill1", "skill2"],
  "recommendation": "Shortlist"
}

Valid values for recommendation: "Shortlist", "Consider", "Reject"
Valid values for fairness_status: "Clean", "Warning"
`;

  return await callClaudeJSON(systemPrompt, `
JD Requirements (Agent 2 output):
${JSON.stringify(jdAnalysis, null, 2)}

Candidate CV Profile (Agent 3 output):
${JSON.stringify(cvAnalysis, null, 2)}
`);
}

module.exports = counterAgentEvaluation;
