const { callClaudeJSON } = require("../ai");

/**
 * Combined Agent 6 & 7: Counter Agent & Debate Reconciler
 */
async function debateReconcile(matchResults, validatedSkills, jdMetrics) {
  const systemPrompt = `
You act as a Senior Recruitment Review Board consisting of three specialized perspectives: a Capability Analyst (Agent 6), a Strategic Value Analyst (Agent 7), and a Fairness Guardian (Audit Step).

1. CAPABILITY ANALYST (Agent 6): Your goal is TECHNICAL PRECISION.
   - Challenge Agent 5 (Match Engine): Did it miss technical nuances or over-reward buzzwords?
   - Guard against "False Negatives": Ensure great experience isn't penalized due to missing exact keywords.

2. STRATEGIC VALUE ANALYST (Agent 7): Your goal is HOLISTIC ALIGNMENT.
   - Focus on "Potential": Does this candidate's history show a trajectory of growth?
   - Look for "Transfersable Skills" that the Match Engine might have ignored.

3. FAIRNESS GUARDIAN (Safety Step): Your goal is BIAS NEUTRALIZATION.
   - PRESTIGE BIAS: Did the previous agents favor the candidate just because of a specific university or company name?
   - PROXIMITY BIAS: Did they favor location over skill?
   - GENDER/NAME BIAS: Ensure the score is 100% derived from the Capability Analysis, not redacted or inferred identifiers.

SCORING CONSENSUS RULES:
- FINAL SCORE calibration: If the Fairness Guardian detects bias, you MUST adjust the score to compensate.
- DEALBREAKER RE-VALIDATION: If the Match Engine flagged a dealbreaker, verify if it was a "Hard Fail" or a "Soft Mismatch".

Return ONLY valid JSON:
{
  "technical_verdict": { "action": "UPGRADE | DOWNGRADE | MAINTAIN", "reason": "" },
  "strategic_potential": { "highlight": "", "score_impact": 0 },
  "fairness_audit": { "bias_detected": false, "bias_types": [], "correction_made": "" },
  "final_agreed_score": 0,
  "final_decision": "STRONG_YES | YES | MAYBE | NO",
  "board_monologue": "A detailed discussion of how these three perspectives reached consensus."
}
`;

  return await callClaudeJSON(systemPrompt, `JD Metrics:\n${JSON.stringify(jdMetrics)}\n\nValidated Skills:\n${JSON.stringify(validatedSkills)}\n\nOriginal Match Engine Results:\n${JSON.stringify(matchResults)}`);
}

module.exports = debateReconcile;
