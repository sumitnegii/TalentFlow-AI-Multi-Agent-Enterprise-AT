const { callClaudeJSON } = require("../ai");

/**
 * Agent: Identity Extractor
 * Extracts personal identifiers from a resume for display in the recruiter dashboard.
 * (Separate from biased-neutral evaluation agents).
 */
async function extractIdentity(cvText) {
  const systemPrompt = `
You are an Expert Resume Data Extractor. Extract personal identifiers and professional links from the provided resume text.

Return ONLY valid JSON:
{
  "full_name": "String (Extract carefully. If not obvious, the very first line of a resume is almost always the candidate's name. Avoid returning null if any name-like string exists at the top.)",
  "email": "String",
  "phone": "String",
  "location": "String (City, Country)",
  "social_links": {
    "linkedin": "URL or null",
    "github": "URL or null",
    "portfolio": "URL or null"
  },
  "current_title": "String (latest job title)",
  "work_summary": "Short 2-sentence professional bio. IMPORTANT: Explicitly mention if experience is an internship and state the duration (e.g., '3-month XML Intern')."
}
`;

  return await callClaudeJSON(systemPrompt, `Resume Text:\n${cvText}`);
}

module.exports = extractIdentity;
