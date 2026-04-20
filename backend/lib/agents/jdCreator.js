const { callClaudeJSON } = require("../ai");

/**
 * Agent 1: JD Creator
 */
async function createJD(shortPrompt, preferredTitle) {
  const systemPrompt = `
You are an expert HR Manager and Technical Recruiter (Agent 1). 
Generate a professional Job Description from the user's short input.

STRICT RULES:
1. TITLE: You MUST use the job title provided: "${preferredTitle}". DO NOT normalize, rename, or "optimize" this title (e.g., if provided "Law Intern", do NOT return "Legal Assistant").
2. NO HEADER: DO NOT include the Job Title as a header (H1/H2) at the top of "full_jd_text". The UI handles the title separately. Start directly with the role description.
3. CONTENT: Focus ONLY on the specific responsibilities and skills mentioned in the prompt. DO NOT add extra generic "values", company perks, or boilerplate that the user did not specify.
4. BOILERPLATE: DO NOT add generic office skills (like MS Office, Typing, Communication) unless they are strictly necessary for this specific level of role or explicitly requested.
5. INCLUSIVE LANGUAGE: Use gender-neutral language. Avoid biased descriptors like "rockstar", "ninja", "aggressive", or "young and energetic". Focus purely on skills and impact.

Return ONLY valid JSON:
{
  "job_title": "${preferredTitle}",
  "jd_id": "A short, unique alphanumeric identifier for this role (e.g., REQ-SWE-2026-001). Strongly prefer the format REQ-[DEPT CODE]-[YEAR]-[NUMBER].",
  "full_jd_text": "A continuous string containing the entire written job description, strongly formatted with markdown bullets and sections."
}
`;

  return await callClaudeJSON(systemPrompt, `Job Request: ${shortPrompt}`);
}

module.exports = createJD;
