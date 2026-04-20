const { callClaudeJSON } = require("../ai");

/**
 * Combined Agent 3 & 4: CV Parser & Skill Validator
 *
 * FIX: Removed the JS-style comment ("// out of 100") from inside the JSON
 * schema example in the system prompt. Claude occasionally echoes the schema
 * literally, and a JS comment inside JSON causes a parse error.
 */
async function parseAndValidateCV(cvText) {
  const systemPrompt = `
You are the Blind Capability Specialist (Agent 3 & 4) on an AI Hiring Board.
Your mission is to perform a clinical, bias-free evaluation of a candidate's professional capabilities.

BLIND REVIEW PROTOCOL:
- COMPLETELY STRIP and IGNORE: Names, gender, age, ethnicity, religious indicators, university prestige (focus only on degree type/field), and photo/appearance.
- ADDRESS/LOCATION: Only consider "Willingness to Relocate" or "Remote Capability" if explicitly stated; otherwise, ignore.

IMPACT EVALUATION (Agent 4):
- Distinguish between "Listed Skills" and "Demonstrated Impact".
- Look for evidence: Numbers, Scale, Complexity, and Specific Outcomes.
- Assign a "Capability Depth" rating based on the complexity of projects, not just years of experience.

Return ONLY valid JSON:
{
  "parsed_data": {
    "experience_years": 0.0,
    "is_fresher": false,
    "domain_expertise": ["Cloud Engineering", "Full-Stack"],
    "seniority_level": "Junior | Mid | Senior | Lead",
    "professional_summary": "A 2-sentence blind bio focused purely on capabilities."
  },
  "validated_skills": {
    "core_competencies": [{ "skill": "", "evidence": "Context from projects", "depth": 0 }],
    "weak_or_unverified_skills": ["List skills mentioned but not backed by project details"],
    "skill_depth_score": 0
  },
  "capability_score": 0,
  "redaction_log": ["Note any PII you observed and are now ignoring (e.g., 'Ignored name: John Doe')"],
  "estimated_parsing_time_seconds": 0
}

skill_depth_score: 0-100 (Technical proficiency)
capability_score: 0-100 (Overall professional maturity and impact)
experience_years: Decimal (0.25 for 3 months)
  `;

  // Measure parsing time
  const startTime = Date.now();
  const result = await callClaudeJSON(systemPrompt, `Raw CV Text:\n${cvText}`);
  const endTime = Date.now();
  const estimatedParsingTimeSeconds = Math.round((endTime - startTime) / 1000);
  // Ensure the result is an object before adding the field
  if (typeof result === 'object' && result !== null) {
    result.estimated_parsing_time_seconds = estimatedParsingTimeSeconds;
  }
  return result;
}

module.exports = parseAndValidateCV;
