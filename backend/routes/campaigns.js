const express = require("express");
const multer = require("multer");
const extractText = require("../utils/extractText");
const JobCampaign = require("../models/JobCampaign");
const JobCandidate = require("../models/JobCandidate");
const { s3 } = require("../config/s3Config");
const { PutObjectCommand } = require("@aws-sdk/client-s3");

// Agents
const createJD = require("../lib/agents/jdCreator");
const analyzeJD = require("../lib/agents/jdAnalyzer");
const cvValidator = require("../lib/agents/cvValidator");
const matchEngine = require("../lib/agents/matchEngine");
const debateReconcile = require("../lib/agents/debateReconciler");
const hrReview = require("../lib/agents/hrReviewer");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ─── 1. Create Campaign ───────────────────────────────────────────────────────
// FIX: Previously only ran Agent 1. Agent 2 (jd_analysis) was a separate call,
// meaning evaluate would silently receive null jd_analysis and fail inside matchEngine.
// Now runs both agents at creation time so the campaign is immediately ready to use.
router.post("/create", async (req, res) => {
  try {
    const { title, prompt, department } = req.body;
    if (!title || !prompt) {
      return res.status(400).json({ error: "title and prompt are required." });
    }

    console.log("[Agent 1] JD Creator: generating JD...");
    const generated = await createJD(prompt, title);

    console.log("[Agent 2] JD Analyzer: extracting requirements...");
    const jdAnalysis = await analyzeJD(generated.full_jd_text);

    const campaign = await JobCampaign.create({
      title,
      department: department || "General",
      job_title: title,
      generated_jd: generated.full_jd_text,
      jd_analysis: jdAnalysis,
      status: "Sourcing",
    });

    res.status(201).json({ success: true, campaign });
  } catch (err) {
    console.error("[campaigns/create]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 2. Get Campaign ──────────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });

    const candidates = await JobCandidate.find({ campaignId: campaign._id }).select("-rawText");
    res.json({ success: true, campaign, candidates });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 3. Analyze JD (kept for backward compat; create now does this automatically) ──
router.post("/:id/analyze-jd", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });

    // Skip if already analyzed
    if (campaign.jd_analysis) {
      return res.json({ success: true, message: "JD already analyzed.", campaign });
    }

    console.log("[Agent 2] JD Analyzer: analyzing JD...");
    const analysis = await analyzeJD(campaign.generated_jd);
    campaign.jd_analysis = analysis;
    campaign.status = "Sourcing";
    await campaign.save();

    res.json({ success: true, campaign });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 4. Upload CVs ────────────────────────────────────────────────────────────
router.post("/:id/upload", upload.array("resumes"), async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });

    const files = req.files || [];
    if (files.length === 0) return res.status(400).json({ error: "No resume files provided." });

    const results = [];
    for (const file of files) {
      try {
        const rawText = await extractText(file);
        const candidate = await JobCandidate.create({
          campaignId: campaign._id,
          fileName: file.originalname,
          full_name: cleanFileName(file.originalname),
          rawText,
          status: "UPLOADED",
        });

        // --- S3 UPLOAD START ---
        console.log(`[S3] Uploading candidate ${file.originalname} to ${process.env.S3_BUCKET_NAME || "hire-buddy-resumes"}`);
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const s3Key = `resumes/${uniqueSuffix}-${file.originalname}`;
        await s3.send(new PutObjectCommand({
          Bucket: process.env.S3_BUCKET_NAME || "hire-buddy-resumes",
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }));
        const s3Url = `https://${process.env.S3_BUCKET_NAME || "hire-buddy-resumes"}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${s3Key}`;
        console.log(`[S3] Success: ${s3Url}`);
        candidate.resume_url = s3Url;
        await candidate.save();
        // --- S3 UPLOAD END ---

        results.push({ fileName: file.originalname, candidateId: candidate._id });
      } catch (err) {
        console.error(`[campaigns-upload] CRITICAL FAIL for ${file.originalname}:`, err.message);
        // We don't delete here because it might be a text extraction error, 
        // but if it's an S3 error it will log clearly.
        results.push({ fileName: file.originalname, error: err.message });
      }
    }

    res.json({ success: true, uploaded: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── 5. Evaluate Single Candidate (Agents 3→4→5→6→7) ───────────────────────
// FIX: Added guard for missing jd_analysis so matchEngine never receives null.
// FIX: Used optional chaining on debate results to prevent crashes on partial JSON.
router.post("/:id/candidates/:candidateId/evaluate", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });

    // Guard: must have jd_analysis before any matching can happen
    if (!campaign.jd_analysis) {
      return res.status(400).json({
        error: "JD not yet analyzed. Call POST /campaigns/:id/analyze-jd first.",
      });
    }

    const candidate = await JobCandidate.findById(req.params.candidateId);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    // Step 1: Agent 3 & 4 (Combined Parse + Validation)
    if (candidate.status === "UPLOADED") {
      console.log(`[Agent 3+4] CV Validator: parsing ${candidate.fileName}...`);
      const { parsed_data, validated_skills } = await cvValidator(candidate.rawText);
      candidate.parsed_data = parsed_data;
      candidate.validated_skills = validated_skills;
      candidate.status = "AGENT_3_4_DONE";
      await candidate.save();
    }

    // Step 2: Agent 5 (Match Engine)
    if (candidate.status === "AGENT_3_4_DONE") {
      console.log(`[Agent 5] Match Engine: scoring ${candidate.fileName}...`);
      const match_results = await matchEngine(candidate.validated_skills, campaign.jd_analysis);
      candidate.match_score = match_results.match_score;
      candidate.match_results = match_results;
      candidate.status = "AGENT_5_DONE";
      await candidate.save();
    }

    // Step 3: Agent 6 & 7 (Counter + Debate)
    if (candidate.status === "AGENT_5_DONE") {
      console.log(`[Agent 6+7] Debate Reconciler: cross-validating ${candidate.fileName}...`);
      const debate = await debateReconcile(
        candidate.match_results,
        candidate.validated_skills,
        campaign.jd_analysis
      );
      candidate.counter_analysis = debate.counter_analysis;
      candidate.corrected_score = debate.counter_analysis?.corrected_score ?? candidate.match_score;
      candidate.debate_summary = debate.debate_summary;
      candidate.final_score = debate.final_agreed_score ?? candidate.match_score;
      candidate.final_decision = debate.final_decision;
      candidate.status = "AGENT_6_7_DONE";
      await candidate.save();
    }

    res.json({ success: true, candidate });
  } catch (err) {
    console.error("[campaigns/evaluate]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── 6. Finalize Campaign (Agent 8 Ranking + Agent 9 HR Review) ──────────────
// FIX: Previously silently dropped candidates not in AGENT_6_7_DONE status.
// Now logs a warning so operators know how many were skipped.
router.post("/:id/finalize", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });

    const allCandidates = await JobCandidate.find({ campaignId: campaign._id });
    const completedCands = allCandidates.filter((c) => c.status === "AGENT_6_7_DONE");
    const skippedCount = allCandidates.length - completedCands.length;

    if (skippedCount > 0) {
      console.warn(
        `[campaigns/finalize] ${skippedCount} candidate(s) not fully evaluated — skipping them.`
      );
    }

    if (completedCands.length === 0) {
      return res.status(400).json({
        error: "No evaluated candidates found. Run /evaluate on each candidate first.",
      });
    }

    // Agent 8: Native JS sort (faster & cheaper than LLM sort)
    console.log("[Agent 8] Ranking Engine: sorting by final_score...");
    const sorted = completedCands.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

    // Agent 9: HR Review — only top 5 to control API usage on large batches
    console.log("[Agent 9] HR Reviewer: writing hiring notes for top candidates...");
    for (let i = 0; i < sorted.length; i++) {
      const cand = sorted[i];
      try {
        if (i < 5) {
          const hrNote = await hrReview(cand, campaign.jd_analysis);
          cand.hr_note = hrNote.summary_note;
        } else {
          cand.hr_note = "Outside top 5 — lower priority. Auto-reviewed.";
        }
      } catch (err) {
        console.error(`[Agent 9] HR review failed for ${cand.fileName}:`, err.message);
        cand.hr_note = "HR review unavailable.";
      }

      cand.rank = i + 1;
      cand.status = "COMPLETED";
      await cand.save();
    }

    campaign.status = "Completed";
    await campaign.save();

    res.json({
      success: true,
      ranked: sorted.length,
      skipped: skippedCount,
    });
  } catch (err) {
    console.error("[campaigns/finalize]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
