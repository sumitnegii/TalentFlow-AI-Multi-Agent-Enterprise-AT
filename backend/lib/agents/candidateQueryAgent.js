const { callClaude } = require("../ai");

/**
 * Candidate Query Agent
 * 
 * Allows recruiters to ask specific questions about a candidate in the context of a JD.
 * Now using Claude for consistent performance across the pipeline.
 */
async function queryCandidate({ candidateName, candidateData, jobDescription, question }) {
  const systemPrompt = `
You are an expert AI Recruiter Assistant. Your goal is to help a human recruiter evaluate a specific candidate for a job role.

JOB DESCRIPTION:
${jobDescription}

TASK:
Provide a concise, professional, and actionable answer based on the candidate's profile and the job requirements. 
Keep the answer under 3-4 sentences. Be direct.
`;

  const userInput = `
CANDIDATE DATA:
- Name: ${candidateName}
- Score: ${candidateData.final_score}%
- AI Insight: ${candidateData.debate_summary}
- HR Note: ${candidateData.hr_note}
- Top Skills: ${JSON.stringify(candidateData.validated_skills?.top_skills || [])}

RECRUITER QUESTION:
"${question}"
`;

  try {
    const answer = await callClaude(systemPrompt, userInput);
    return { answer: answer.trim() };
  } catch (err) {
    console.error(`[CandidateQueryAgent] API ERROR:`, err.message);
    throw new Error(`AI Assistant Error: ${err.message}`);
  }
}

module.exports = queryCandidate;
