const { callClaude } = require("../ai");

/**
 * JD Matcher Agent
 * Compares JD requirements against CV analysis.
 */
async function matchJD(jdAnalysis, cvAnalysis) {
  const systemPrompt = `
You are an AI Recruitment Matcher. Your task is to compare a Job Description analysis with a Candidate's CV analysis and determine the match quality.

Provide:
1. Match Score (0-100)
2. Skills Gap (missing skills)
3. Experience Match (does the duration work?)
4. Project Relevance (how closely do candidate projects match JD needs?)
5. Recommendation (Shortlist, Potential, or Reject)

Return ONLY valid JSON.
`;

  const userInput = `
Job Description Analysis:
${JSON.stringify(jdAnalysis, null, 2)}

Candidate CV Analysis:
${JSON.stringify(cvAnalysis, null, 2)}
`;

  try {
    const matching = await callClaude(systemPrompt, userInput);
    return matching;
  } catch (error) {
    console.error("JD Matcher Error:", error);
    throw new Error("Failed to match JD and CV.");
  }
}

module.exports = matchJD;
