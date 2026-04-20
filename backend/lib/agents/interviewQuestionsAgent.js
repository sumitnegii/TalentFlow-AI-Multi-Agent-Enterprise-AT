const { callClaudeJSON } = require("../ai");

/**
 * Interview Questions Agent
 *
 * Given a candidate's validated skills, experience level, and the JD requirements,
 * generates tailored interview questions (technical + behavioural).
 *
 * Returns:
 * {
 *   technical: ["Q1", "Q2", ...],
 *   behavioural: ["Q1", "Q2", ...],
 *   system_design: ["Q1", ...],   // optional, only relevant roles
 *   red_flags: ["Q1", ...]         // questions targeting gaps
 * }
 */
async function generateInterviewQuestions({ candidateSkills, candidateName, jdRequirements, jobTitle }) {
  const systemPrompt = `
You are a senior technical interviewer. Generate targeted, specific interview questions
for the candidate based on their skills and the job requirements.

Rules:
- Questions must be specific to the candidate's background and the role.
- Technical questions must be solvable in a 45-min interview (not too broad).
- Behavioural questions must use STAR format prompts.
- Generate questions that probe skill gaps (areas where candidate may be weak).
- Return ONLY valid JSON.

Return this exact structure:
{
  "technical": ["<question>", ...],
  "behavioural": ["<question>", ...],
  "gap_probes": ["<question targeting a weakness>", ...],
  "opening": "<1 warm-up ice-breaker question>",
  "summary": "<2-sentence note on what aspects to focus on for this candidate>"
}
`;

  const userPrompt = `
Candidate: ${candidateName}
Role: ${jobTitle}
Candidate Skills: ${JSON.stringify(candidateSkills)}
JD Requirements: ${JSON.stringify(jdRequirements)}

Generate 3 technical questions, 2 behavioural questions, and 2 gap probe questions.
`;

  return await callClaudeJSON(systemPrompt, userPrompt);
}

module.exports = generateInterviewQuestions;
