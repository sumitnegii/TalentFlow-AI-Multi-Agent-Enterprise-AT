const { callClaudeJSON } = require("../ai");

/**
 * Agent 3: CV Analyzer (Unbiased)
 *
 * FIX: Was using callClaude (returns raw string). All callers do
 * JSON.stringify(cvAnalysis) or read cvAnalysis.technical_skills, etc.
 * Switching to callClaudeJSON so the return value is always a parsed object.
 */
async function analyzeCV(cvText) {
  const systemPrompt = `
You are an Unbiased Profile Specialist on the AI Hiring Board. Extract skills, experience, and achievements
from the resume while completely ignoring personal identifiers (name, gender, age, ethnicity,
photo, address) to ensure the board receives a bias-free evaluation.

Return ONLY valid JSON:
{
  "technical_skills": { "category_name": ["skill1", "skill2"] },
  "experience_years": 0,
  "recent_projects": [{ "name": "", "summary": "", "tech_stack": [] }],
  "education": [{ "degree": "", "institution": "", "year": "" }],
  "certifications": ["cert1"],
  "achievements": ["achievement1"]
}
`;

  return await callClaudeJSON(systemPrompt, `Resume Content:\n${cvText}`);
}

module.exports = analyzeCV;
