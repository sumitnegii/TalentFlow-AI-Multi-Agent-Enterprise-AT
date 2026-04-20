const { callClaudeJSON } = require("../ai");

/**
 * Agent 2: JD Analyzer
 */
async function analyzeJD(jdText) {
  const systemPrompt = `
You are a Senior Role Specialist on the AI Hiring Board.
Extract the strict evaluation metrics, weightages, and scoring rubrics from the provided Job Description.

STRICT RULES:
1. CORE SKILLS ONLY: Extract only technical or role-specific skills explicitly mentioned.
2. DEALBREAKERS: Identify "Must-Have" requirements that are non-negotiable (e.g., "Must have 5+ years of React", "Willing to travel").
3. SCORING RUBRIC: Define what constitutes a "Gold Standard" (100%), "Silver" (70%), and "Bronze" (40%) candidate for this specific role.
4. IGNORE BOILERPLATE: Do NOT include generic skills (MS Office, Teamwork) unless explicitly highlighted as CRITICAL.

Return ONLY valid JSON:
{
  "must_have_skills": [],
  "optional_skills": [],
  "dealbreakers": ["List of non-negotiable requirements"],
  "min_experience": 0,
  "weightage": {
    "skills": 50,
    "experience": 30,
    "projects": 20
  },
  "scoring_rubric": {
    "technical_fit": "Criteria for 100/100 skill match",
    "experience_depth": "Criteria for 100/100 experience match",
    "project_impact": "Criteria for 100/100 project relevance"
  }
}

IMPORTANT: Total weightage MUST equal 100.
`;

  return await callClaudeJSON(systemPrompt, `Job Description:\n${jdText}`);
}

module.exports = analyzeJD;
