const express = require("express");
const Groq = require("groq-sdk");
const Candidate = require("../models/Candidate");
const Job = require("../models/Job");
const auth = require("../middleware/auth");

const router = express.Router();

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// POST /shortlist/score — score all candidates against a job
router.post("/score", auth, async (req, res) => {
  try {
    const groq = getGroqClient();
    if (!groq) return res.status(500).json({ error: "GROQ_API_KEY is not set" });
    const { jobId } = req.body;
    const job = await Job.findOne({ _id: jobId, recruiter: req.recruiter._id });
    if (!job) return res.status(404).json({ error: "Job not found" });

    const candidates = await Candidate.find({ recruiterId: req.recruiter._id });
    const results = [];

    for (const candidate of candidates) {
      const prompt = `You are an expert technical recruiter. Score this candidate against the job description.

JOB: ${job.title}
Required skills: ${(job.skills || []).join(", ")}
Experience required: ${job.experienceYears} years
Description: ${job.description}

CANDIDATE CV SUMMARY:
${(candidate.cvText || candidate.resumeText || "").slice(0, 1500)}

Return ONLY valid JSON with:
- matchScore (integer 0-100)
- strengths (array of 3 short strings)
- gaps (array of 2 short strings)
- recommendation (one of: "shortlist", "review", "reject")
- summary (1 sentence)`;

      const aiRes = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      const score = JSON.parse(aiRes.choices[0].message.content);

      await Candidate.findByIdAndUpdate(candidate._id, {
        matchScore: score.matchScore,
        strengths: score.strengths,
        gaps: score.gaps,
        recommendation: score.recommendation,
        scoreSummary: score.summary,
        scoredForJob: jobId
      });

      results.push({ candidate: candidate._id, name: candidate.name, ...score });
    }

    res.json({
      scored: results.length,
      results: results.sort((a, b) => b.matchScore - a.matchScore)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /shortlist/:jobId — get already-scored candidates for a job
router.get("/:jobId", auth, async (req, res) => {
  try {
    const candidates = await Candidate.find({
      recruiterId: req.recruiter._id,
      scoredForJob: req.params.jobId
    }).sort({ matchScore: -1 });
    res.json(candidates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
