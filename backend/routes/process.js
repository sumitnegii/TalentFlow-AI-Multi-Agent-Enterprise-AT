const express = require("express");
const multer = require("multer");
const extractText = require("../utils/extractText");
const authMiddleware = require("../middleware/auth");

// Import The 6 Agents Pipeline
const createJD = require("../lib/agents/jdCreator");
const analyzeJD = require("../lib/agents/jdAnalyzer");
const analyzeCV = require("../lib/agents/cvAnalyzer");
const counterAgentEvaluation = require("../lib/agents/counterAgent");
const rankCandidates = require("../lib/agents/rankingEngine");
const hrReview = require("../lib/agents/hrReviewer");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } });

router.post("/", upload.fields([
  { name: "job_description_file", maxCount: 1 },
  { name: "resumes", maxCount: 20 }
]), async (req, res) => {
  try {
    const jdText = req.body.job_description || "";
    const files = req.files || {};

    if (!jdText && !files.job_description_file) {
      return res.status(400).json({ error: "Job description or brief prompt is required." });
    }

    if (!files.resumes || files.resumes.length === 0) {
      return res.status(400).json({ error: "At least one resume is required." });
    }

    // Pipeline Step 1: Establish JD Text
    let finalJdText = jdText;
    let generatedJDData = null;

    if (files.job_description_file) {
      finalJdText = await extractText(files.job_description_file[0]);
    } else if (jdText.length < 150) {
      // Agent 1: JD Creator (If user provides only a short prompt/title)
      console.log("Agent 1 [JD Creator]: Generating full JD from short prompt...");
      generatedJDData = await createJD(jdText);
      finalJdText = generatedJDData.full_jd_text;
    }

    // Agent 2: JD Analyzer
    console.log("Agent 2 [JD Analyzer]: Extracting key requirements...");
    const jdAnalysis = await analyzeJD(finalJdText);

    const candidateResults = [];
    console.log(`Processing ${files.resumes.length} candidate resumes...`);

    // Process each Candidate
    for (const file of files.resumes) {
      try {
        const cvText = await extractText(file);
        
        console.log(`Agent 3 [CV Analyzer]: Unbiased extraction for ${file.originalname}...`);
        const cvAnalysis = await analyzeCV(cvText);
        
        console.log(`Agent 4 [Counter Agent]: Critical evaluation for ${file.originalname}...`);
        const evaluation = await counterAgentEvaluation(jdAnalysis, cvAnalysis);
        
        // Merge match_score so frontend table still works seamlessly
        const jd_matching = {
          match_score: evaluation.match_score,
          skills_gap: evaluation.skills_gap,
          recommendation_reason: evaluation.critical_analysis
        };

        const fairness_checks = {
          fairness_score: evaluation.fairness_status === "Clean" ? 100 : 50,
          summary: `Counter Agent Report: ${evaluation.fairness_status}. ${evaluation.critical_analysis}`
        };

        candidateResults.push({
          fileName: file.originalname,
          cv_analysis: cvAnalysis,
          jd_matching: jd_matching,
          fairness_checks: fairness_checks,
          raw_evaluation: evaluation
        });
      } catch (fileError) {
        console.error(`Error processing ${file.originalname}:`, fileError);
        candidateResults.push({
          fileName: file.originalname,
          error: "Failed to process candidate."
        });
      }
    }

    // Agent 5: Ranking Engine
    console.log("Agent 5 [Ranking Engine]: Sorting and selecting top candidates...");
    const ranking = await rankCandidates(candidateResults);

    // Agent 6: HR Final Reviewer
    console.log("Agent 6 [HR Reviewer]: Generating final executive summaries...");
    for (const cand of candidateResults) {
      if (!cand.error) {
        cand.final_hr_decision = await hrReview(cand, ranking);
      }
    }

    res.json({
      success: true,
      data: {
        jd_analysis: jdAnalysis,
        generated_jd: generatedJDData, // Provide generated JD to frontend
        candidates: candidateResults,
        ranking: ranking
      }
    });

  } catch (error) {
    console.error("Pipeline Error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during the recruitment pipeline processing.",
      error: error.message
    });
  }
});

module.exports = router;
