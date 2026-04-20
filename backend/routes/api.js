/**
 * routes/api.js
 *
 * Unified API endpoints for the 9-agent recruitment pipeline.
 *
 * POST /api/job/create           → Agent 1 (JD Creator) + Agent 2 (JD Analyzer)
 * POST /api/candidate/upload     → Upload CVs + Agent 3+4 (CV Validator) immediately
 * POST /api/process              → Agents 5-9 on all pending candidates for a job
 * GET  /api/results/:jobId       → Ranked results with all evaluation data
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

function cleanFileName(fileName) {
  if (!fileName) return "Unknown Candidate";
  // Remove extension
  let name = fileName.replace(/\.[^/.]+$/, "");
  // Remove "WhatsApp Image YYYY-MM-DD at HH.MM.SS" pattern
  name = name.replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, "");
  // Remove " (1)", " (2)" etc
  name = name.replace(/ \(\d+\)/g, "");
  // Remove generic prefixes
  name = name.replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, "");
  // Clean up remaining dashes/underscores and double spaces
  name = name.replace(/[_\-]+/g, " ").replace(/\s\s+/g, " ").trim();
  
  return name || "Candidate";
}
const router = express.Router();

const JobCampaign = require("../models/JobCampaign");
const Job = require("../models/Job"); // LEGACY
const JobCandidate = require("../models/JobCandidate");
const Candidate = require("../models/Candidate"); // LEGACY
const GlobalCandidate = require("../models/GlobalCandidate"); // NEW
const JobApplication = require("../models/JobApplication"); // NEW
const Comment = require("../models/Comment");
const ActivityLog = require("../models/ActivityLog");
const Task = require("../models/Task");
const Approval = require("../models/Approval");
const extractText = require("../utils/extractText");
const { s3, getSignedUrl } = require("../config/s3Config");
const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");

// Agents
const createJD = require("../lib/agents/jdCreator");
const analyzeJD = require("../lib/agents/jdAnalyzer");
const cvValidator = require("../lib/agents/cvValidator");
const extractIdentity = require("../lib/agents/identityExtractor"); // NEW
const matchEngine = require("../lib/agents/matchEngine");
const debateReconcile = require("../lib/agents/debateReconciler");
const hrReview = require("../lib/agents/hrReviewer");
const generateInterviewQuestions = require("../lib/agents/interviewQuestionsAgent");
const generateRejectionInsight = require("../lib/agents/rejectionInsightAgent");
const generateRecommendation = require("../lib/agents/recommendationAgent");
const queryCandidate = require("../lib/agents/candidateQueryAgent");
const { runAutomatedPipeline } = require("../utils/pipelineHelper");

const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/job/create
// Body: { title, prompt, department? }
//
// Runs Agent 1 (JD Creator) and Agent 2 (JD Analyzer) in sequence,
// persists the campaign, and returns it ready for CV uploads.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/job/create", async (req, res) => {
  try {
    const { title, prompt, department, positions } = req.body;
    if (!title || !prompt) {
      return res.status(400).json({ error: "title and prompt are required." });
    }

    console.log("[Agent 1] JD Creator: generating JD from prompt...");
    const generated = await createJD(prompt, title);

    console.log("[Agent 2] JD Analyzer: extracting requirements and weightage...");
    const jdAnalysis = await analyzeJD(generated.full_jd_text);

    const campaign = await JobCampaign.create({
      title,
      department: department || "General",
      job_title: generated.job_title || title,
      jd_id: generated.jd_id || `REQ-${Math.floor(Math.random() * 10000)}`,
      generated_jd: generated.full_jd_text,
      jd_analysis: jdAnalysis,
      status: "Sourcing",
      positions: positions || 1,
      job_status: "Open"
    });

    res.status(201).json({
      success: true,
      job: {
        id: campaign._id,
        title: campaign.title,
        job_title: campaign.job_title,
        department: campaign.department,
        status: campaign.status,
        job_status: campaign.job_status,
        positions: campaign.positions,
        generated_jd: campaign.generated_jd,
        jd_analysis: campaign.jd_analysis,
      },
    });
  } catch (err) {
    console.error("[POST /api/job/create]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/campaigns
//
// Fetches all campaigns to display on the main dashboard.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await JobCampaign.find().sort({ createdAt: -1 });
    const legacyJobs = await Job.find().sort({ createdAt: -1 });

    // Enrich JobCampaigns
    const enrichedCampaigns = await Promise.all(
      campaigns.map(async (c) => {
        const total = await JobCandidate.countDocuments({ campaignId: c._id });
        const shortlisted = await JobCandidate.countDocuments({
          campaignId: c._id,
          final_decision: { $in: ["STRONG_YES", "YES"] },
        });
        const hiredCount = await JobCandidate.countDocuments({
          campaignId: c._id,
          interview_stage: "Hired",
        });

        const stages = c.pipeline_stages || ["Applied", "Screening", "Interview", "Offer", "Hired"];
        const stageCounts = {};
        await Promise.all(
          stages.map(async (s) => {
            stageCounts[s] = await JobCandidate.countDocuments({
              campaignId: c._id,
              interview_stage: s,
            });
          })
        );

        return { 
          ...c.toObject(), 
          candidateCount: total, 
          shortlisted, 
          hiredCount,
          stageCounts,
          isLegacy: false
        };
      })
    );

    // Enrich Legacy Jobs
    const enrichedLegacy = await Promise.all(
      legacyJobs.map(async (j) => {
        const total = await Candidate.countDocuments({ job: j.title });
        const hiredCount = await Candidate.countDocuments({ job: j.title, stage: "hired" });
        
        // Simple mapping for legacy stages
        const stageCounts = {
          "Applied": await Candidate.countDocuments({ job: j.title, stage: "applied" }),
          "Screening": await Candidate.countDocuments({ job: j.title, stage: "shortlisted" }),
          "Interview": await Candidate.countDocuments({ job: j.title, stage: "interview" }),
          "Offer": await Candidate.countDocuments({ job: j.title, stage: "offered" }),
          "Hired": hiredCount
        };

        return {
          _id: j._id,
          title: j.title,
          department: j.company || "General",
          kanban_stage: j.status === "closed" ? "Hired" : "Sourcing",
          candidateCount: total,
          hiredCount,
          stageCounts,
          isLegacy: true,
          updatedAt: j.createdAt,
          createdAt: j.createdAt
        };
      })
    );

    res.json({ success: true, campaigns: [...enrichedCampaigns, ...enrichedLegacy] });
  } catch (err) {
    console.error("[GET /api/campaigns]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/campaign/:id
//
// Deletes a campaign and all associated candidates.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/campaign/:id", async (req, res) => {
  try {
    const campaign = await JobCampaign.findByIdAndDelete(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    await JobCandidate.deleteMany({ campaignId: req.params.id });
    res.json({ success: true, message: "Campaign and all candidates deleted." });
  } catch (err) {
    console.error("[DELETE /api/campaign]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/upload
// Form-data: jobId (text field) + resumes (files, up to 50)
//
// Extracts text from each file, stores the candidate, then immediately runs
// Agent 3+4 (CV Validator). Saves after each file so a crash mid-batch
// doesn't lose already-processed candidates.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/upload", upload.array("resumes", 50), async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: "jobId is required." });

    const campaign = await JobCampaign.findById(jobId);
    if (!campaign) return res.status(404).json({ error: "Job not found." });
    if (!campaign.jd_analysis) {
      return res.status(400).json({
        error: "JD analysis is missing. Create the job via POST /api/job/create first.",
      });
    }

    const files = req.files || [];
    if (files.length === 0) {
      return res.status(400).json({ error: "No resume files provided." });
    }

    const results = [];

    for (const file of files) {
      // Save with UPLOADED status first — this record persists even if Agent 3+4 fails
      let candidate;
      try {
        // Use buffer directly for text extraction
        const rawText = await extractText(file);
        
        candidate = await JobCandidate.create({
          campaignId: campaign._id,
          fileName: file.originalname,
          full_name: cleanFileName(file.originalname),
          rawText,
          status: "UPLOADED",
        });

        // --- S3 UPLOAD START ---
        const bucketName = (process.env.S3_BUCKET_NAME || "hire-buddy-resumes").trim();
        const awsRegion = (process.env.AWS_REGION || "ap-south-1").trim();
        
        console.log(`[S3] API: Uploading candidate ${file.originalname} to ${bucketName}`);
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const s3Key = `resumes/${uniqueSuffix}-${file.originalname}`;
        await s3.send(new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }));
        const s3Url = `https://${bucketName}.s3.${awsRegion}.amazonaws.com/${s3Key}`;
        console.log(`[S3] API: Success: ${s3Url}`);
        candidate.resume_url = s3Url;
        await candidate.save();
        // --- S3 UPLOAD END ---
      } catch (err) {
        console.error(`[upload] CRITICAL FAIL for ${file.originalname}:`, err.message);
        // Delete the draft candidate if S3/Text failed
        if (candidate) await JobCandidate.findByIdAndDelete(candidate._id);
        results.push({ fileName: file.originalname, error: `Upload failed: ${err.message}` });
        continue;
      }

      // Immediately parse + validate (Agent 3+4)
      try {
        console.log(`[Agent 3+4] CV Validator: parsing ${file.originalname}...`);
        
        // Step A: Extract Identity (Name/Contact/Socials)
        const identityData = await extractIdentity(candidate.rawText).catch(e => {
          console.error("[Identity] Failed:", e.message);
          return {};
        });

        // Step B: Extract Capability (Biased-neutral skills/exp)
        const { parsed_data, validated_skills } = await cvValidator(candidate.rawText);
        
        // --- CENTRALIZED IDENTITY LOGIC ---
        const email = identityData.email?.toLowerCase();
        let globalCandidate;

        if (email) {
          globalCandidate = await GlobalCandidate.findOne({ email });
          if (globalCandidate) {
            console.log(`[Identity] Found existing global candidate: ${email}`);
            // Update global candidate with potentially new data
            globalCandidate.parsed_data = { ...(globalCandidate.parsed_data || {}), ...parsed_data, ...identityData };
            globalCandidate.validated_skills = validated_skills;
            globalCandidate.resume_url = candidate.resume_url;
            globalCandidate.name = identityData.full_name || globalCandidate.name;
            globalCandidate.phone = identityData.phone || globalCandidate.phone;
            globalCandidate.rawText = candidate.rawText;
            await globalCandidate.save();
          } else {
            globalCandidate = await GlobalCandidate.create({
              email,
              name: identityData.full_name || cleanFileName(file.originalname),
              phone: identityData.phone || "",
              parsed_data: { ...parsed_data, ...identityData },
              validated_skills,
              resume_url: candidate.resume_url,
              rawText: candidate.rawText
            });
          }
        }

        // Create JobApplication (The role-specific record)
        if (globalCandidate) {
          // Check if already applied to this specific job
          let application = await JobApplication.findOne({ 
            candidateId: globalCandidate._id, 
            jobId: campaign._id 
          });

          if (!application) {
            application = await JobApplication.create({
              candidateId: globalCandidate._id,
              jobId: campaign._id,
              status: "AGENT_3_4_DONE",
              interview_stage: "Applied"
            });
          } else {
            // Already applied, update status if needed
            application.status = "AGENT_3_4_DONE";
            await application.save();
          }

          // We can now delete the temporary JobCandidate draft
          // or mark it as completed/linked. For now, let's keep it 
          // but eventually we want to query JobApplication instead.
          candidate.status = "AGENT_3_4_DONE";
          candidate.isLegacy = false; // Mark as new-architecture compatible
          await candidate.save();
        }

        results.push({
          fileName: file.originalname,
          candidateId: globalCandidate ? globalCandidate._id : candidate._id,
          status: "DONE",
        });
      } catch (err) {
        // Keep the record at UPLOADED so /api/process can retry it
        console.error(`[Agent 3+4] Failed for ${file.originalname}:`, err.message);
        results.push({
          fileName: file.originalname,
          candidateId: candidate._id,
          status: "UPLOADED",
          error: `CV parsing failed: ${err.message}`,
        });
      }
    }

    // Trigger full evaluation pipeline in background
    runAutomatedPipeline(jobId).catch(err => {
      console.error("[upload-bg] Auto-pipeline failed:", err.message);
    });

    res.json({ success: true, uploaded: results });
  } catch (err) {
    console.error("[POST /api/candidate/upload]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/process
// Body: { jobId }
//
// Runs the full pipeline on ALL pending candidates for a job:
//   • Re-runs Agent 3+4 on any still at UPLOADED (retry after upload failure)
//   • Agent 5  – Match Engine
//   • Agent 6+7 – Counter + Debate Reconciler
//   • Agent 8  – Native JS sort (no API cost)
//   • Agent 9  – HR Review (top 5 only)
//
// Processes ONE candidate at a time to avoid rate limits.
// Saves after each agent step — pipeline can be safely re-run after a crash.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/process", async (req, res) => {
  try {
    const { jobId } = req.body;
    if (!jobId) return res.status(400).json({ error: "jobId is required." });

    // Since runAutomatedPipeline is async and doesn't return counts, 
    // we just trigger it and return a success message.
    // If we want it to be synchronous for the API caller, we can await it.
    await runAutomatedPipeline(jobId);

    res.json({
      success: true,
      message: `Evaluation pipeline completed for job ${jobId}.`,
    });
  } catch (err) {
    console.error("[POST /api/process]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/results/:jobId
//
// Returns the job details and all candidates sorted by rank.
// rawText is excluded to keep the response size manageable.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/results/:jobId", async (req, res) => {
  try {
    let jobData;
    let candidates = [];
    
    // 1. Try modern JobCampaign
    const campaign = await JobCampaign.findById(req.params.jobId);
    
    if (campaign) {
      jobData = {
        id: campaign._id,
        title: campaign.title,
        job_title: campaign.job_title,
        department: campaign.department,
        status: campaign.status,
        job_status: campaign.job_status,
        positions: campaign.positions,
        generated_jd: campaign.generated_jd,
        jd_analysis: campaign.jd_analysis,
        isLegacy: false
      };

      const applications = await JobApplication.find({ jobId: campaign._id })
        .populate("candidateId")
        .sort({ rank: 1, final_score: -1 });

      const legacyJobCandidates = await JobCandidate.find({ 
        campaignId: campaign._id,
        isLegacy: { $ne: false } 
      }).select("-rawText");

      candidates = [
        ...applications.map(app => ({
          ...app.candidateId.toObject(),
          ...app.toObject(),
          _id: app._id,
          globalCandidateId: app.candidateId._id,
          isLegacy: false
        })),
        ...legacyJobCandidates.map(c => ({
          ...c.toObject(),
          isLegacy: true
        }))
      ];
    } else {
      // 2. Try legacy Job
      const legacyJob = await Job.findById(req.params.jobId);
      if (!legacyJob) return res.status(404).json({ error: "Job not found." });

      jobData = {
        id: legacyJob._id,
        title: legacyJob.title,
        job_title: legacyJob.title,
        department: legacyJob.company || "General",
        status: legacyJob.status === "active" ? "PUBLISHED" : "CLOSED",
        job_status: legacyJob.status === "active" ? "Open" : "Closed",
        positions: 1,
        generated_jd: legacyJob.description,
        isLegacy: true
      };

      const legacyCandidates = await Candidate.find({ job: legacyJob.title }).sort({ totalScore: -1 });
      
      const STAGE_MAP = {
        'applied': 'Applied',
        'shortlisted': 'Screening',
        'interview': 'Interview',
        'offered': 'Offer',
        'hired': 'Hired',
        'rejected': 'Rejected'
      };

      candidates = legacyCandidates.map(c => ({
        _id: c._id,
        full_name: c.name || c.originalFileName?.replace(/\.[^/.]+$/, "") || "Candidate",
        final_score: c.totalScore || c.matchScore || c.score || 0,
        interview_stage: STAGE_MAP[c.stage] || "Applied",
        final_decision: c.stage === 'shortlisted' ? 'YES' : c.stage === 'rejected' ? 'NO' : 'PENDING',
        isLegacy: true,
        campaignTitle: legacyJob.title
      }));
    }

    candidates.sort((a, b) => (b.final_score ?? b.match_score ?? 0) - (a.final_score ?? a.match_score ?? 0));

    const shortlisted = candidates.filter(c => c.final_decision === "STRONG_YES" || c.final_decision === "YES");
    const maybes = candidates.filter(c => c.final_decision === "MAYBE");
    const rejected = candidates.filter(c => c.final_decision === "NO");

    res.json({
      success: true,
      job: jobData,
      summary: {
        total: candidates.length,
        shortlisted: shortlisted.length,
        maybes: maybes.length,
        rejected: rejected.length,
      },
      candidates,
    });
  } catch (err) {
    console.error("[GET /api/results]", err.message);
    res.status(500).json({ error: err.message });
  }
});


// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/job/:id/status
// Explicitly toggle a job between Open and Closed.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/job/:id/status", async (req, res) => {
  try {
    const { job_status } = req.body;
    if (!["Open", "Closed"].includes(job_status)) {
      return res.status(400).json({ error: "Invalid status. Allowed: Open, Closed" });
    }
    const campaign = await JobCampaign.findByIdAndUpdate(
      req.params.id,
      { job_status },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: "Job not found." });
    res.json({ success: true, job_status: campaign.job_status });
  } catch (err) {
    console.error("[PATCH /api/job/status]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/campaign/:id/stage
// Body: { kanban_stage }
// Moves a campaign card to a different Kanban column.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/campaign/:id/stage", async (req, res) => {
  try {
    const { kanban_stage } = req.body;
    const allowed = ["Sourcing", "Screening", "Interview", "Offer", "Hired"];
    if (!allowed.includes(kanban_stage)) {
      return res.status(400).json({ error: `Invalid stage. Allowed: ${allowed.join(", ")}` });
    }
    const campaign = await JobCampaign.findByIdAndUpdate(
      req.params.id,
      { kanban_stage },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });
    res.json({ success: true, campaign });
  } catch (err) {
    console.error("[PATCH /api/campaign/stage]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/candidate/:id
// Permanently removes a candidate and their associated resume file.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/candidate/:id", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    // Clean up file system if resume exists
    if (candidate.resume_url) {
      const filePath = path.join(__dirname, "..", candidate.resume_url);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (unlinkErr) {
          console.error("[DELETE /api/candidate] File unlink failed:", unlinkErr.message);
        }
      }
    }

    await JobCandidate.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: "Candidate and associated data deleted." });
  } catch (err) {
    console.error("[DELETE /api/candidate]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/application/:id/interview
// Adds a new interview round and logs timeline event.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/application/:id/interview", async (req, res) => {
  try {
    const { type, title, interviewerName, scheduledAt } = req.body;
    const app = await JobApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    app.interviews = app.interviews || [];
    app.interviews.push({
      type: type || "Technical",
      title: title || `${type} Round`,
      interviewer: { name: interviewerName },
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: "Scheduled"
    });

    app.timeline = app.timeline || [];
    app.timeline.push({
      event: "Interview Scheduled",
      date: new Date(),
      user: "System",
      details: `${title || type} scheduled with ${interviewerName}`
    });

    await app.save();
    res.json({ success: true, application: app });
  } catch (err) {
    console.error("[POST /api/application/interview]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/application/:id/interview/:roundId
// Updates interview round status or details.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/application/:id/interview/:roundId", async (req, res) => {
  try {
    const app = await JobApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    const round = app.interviews.id(req.params.roundId);
    if (!round) return res.status(404).json({ error: "Round not found" });

    if (req.body.status) round.status = req.body.status;
    if (req.body.interviewerName) round.interviewer.name = req.body.interviewerName;
    if (req.body.scheduledAt) round.scheduledAt = new Date(req.body.scheduledAt);

    await app.save();
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/application/:id/interview/:roundId/feedback
// Submits scorecard for an interview round.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/application/:id/interview/:roundId/feedback", async (req, res) => {
  try {
    const { rating, strengths, concerns, decision, interviewerName } = req.body;
    const app = await JobApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: "Application not found" });

    const round = app.interviews.id(req.params.roundId);
    if (!round) return res.status(404).json({ error: "Round not found" });

    round.feedback = round.feedback || [];
    round.feedback.push({
      interviewerName,
      rating,
      strengths,
      concerns,
      decision,
      submittedAt: new Date()
    });

    round.status = "Completed";

    app.timeline = app.timeline || [];
    app.timeline.push({
      event: "Feedback Added",
      date: new Date(),
      user: interviewerName || "Interviewer",
      details: `${decision} (${rating}/5) for ${round.title}`
    });

    await app.save();
    res.json({ success: true, application: app });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidate/:id
// Full candidate profile including populated campaign info.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Context Resolution: Find the primary record (either a New App or Legacy Candidate)
    let application = await JobApplication.findById(id).populate("candidateId");
    let legacyCandidate = null;
    let baseCandidate = null;

    if (application) {
      baseCandidate = application.candidateId;
    } else {
      legacyCandidate = await JobCandidate.findById(id).select("-rawText");
      if (!legacyCandidate) {
        return res.status(404).json({ success: false, error: "Candidate or Application not found." });
      }
      baseCandidate = legacyCandidate;
    }

    // 2. Identity Keys for cross-matching
    const emailStr = baseCandidate.email || baseCandidate.parsed_data?.email;
    const fuzzyName = (baseCandidate.parsed_data?.full_name || baseCandidate.fileName || "Candidate").toLowerCase().replace(/[^a-z0-9]/g, "");

    // 3. Fetch all New Applications for this email
    let allNewApps = [];
    if (emailStr) {
      const globalCand = await GlobalCandidate.findOne({ email: emailStr });
      if (globalCand) {
        allNewApps = await JobApplication.find({ candidateId: globalCand._id })
          .populate("jobId", "title job_title department positions job_status kanban_stage createdAt")
          .sort({ createdAt: -1 });
      }
    }

    // 4. Fetch all Legacy Applications for this email/name
    const legacyQuery = [];
    if (emailStr) legacyQuery.push({ email: emailStr }, { 'parsed_data.email': emailStr });
    
    let allLegacyApps = [];
    if (legacyQuery.length > 0) {
      allLegacyApps = await JobCandidate.find({ $or: legacyQuery }).select("parsed_data fileName jobId campaignId interview_stage final_score match_score final_decision createdAt");
    } else if (fuzzyName) {
      const allLegacy = await JobCandidate.find({}).select("parsed_data fileName jobId campaignId interview_stage final_score match_score final_decision createdAt");
      allLegacyApps = allLegacy.filter(c => {
        const cFuzzy = (c.parsed_data?.full_name || c.fileName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        return cFuzzy === fuzzyName;
      });
    }

    // 5. Merge and Standardize
    const finalApps = [];
    const jobIdsSeen = new Set();

    // Map New System apps
    for (const app of allNewApps) {
      const camp = app.jobId;
      const unified = {
        _id: app._id,
        jobTitle: camp?.job_title || camp?.title || 'Unknown Role',
        campaignTitle: camp?.title,
        jobId: camp?._id,
        department: camp?.department,
        positions: camp?.positions,
        job_status: camp?.job_status,
        kanban_stage: camp?.kanban_stage,
        jobPostedAt: camp?.createdAt,
        stage: app.interview_stage || 'Applied',
        score: app.final_score || app.match_score,
        final_decision: app.final_decision,
        status: app.final_decision,
        createdAt: app.createdAt
      };
      finalApps.push(unified);
      if (unified.jobId) jobIdsSeen.add(String(unified.jobId));
    }

    // Map Legacy System apps
    for (const app of allLegacyApps) {
      const campId = app.jobId || app.campaignId;
      if (campId && jobIdsSeen.has(String(campId))) continue;

      const camp = await JobCampaign.findById(campId).select("title job_title department positions job_status kanban_stage createdAt");
      const unified = {
        _id: app._id,
        jobTitle: camp?.job_title || camp?.title || 'Unknown Role',
        campaignTitle: camp?.title,
        jobId: camp?._id,
        department: camp?.department,
        positions: camp?.positions,
        job_status: camp?.job_status,
        kanban_stage: camp?.kanban_stage,
        jobPostedAt: camp?.createdAt,
        stage: app.interview_stage || 'Applied',
        score: app.final_score || app.match_score,
        final_decision: app.final_decision,
        status: app.final_decision,
        createdAt: app.createdAt
      };
      finalApps.push(unified);
      if (unified.jobId) jobIdsSeen.add(String(unified.jobId));
    }

    finalApps.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 6. Return response
    const currentCampaignId = application ? application.jobId : (legacyCandidate.jobId || legacyCandidate.campaignId);
    const campaign = await JobCampaign.findById(currentCampaignId).select("title department kanban_stage jd_analysis");

    return res.json({
      success: true,
      candidate: {
        ...(application ? { ...application.candidateId.toObject(), ...application.toObject() } : legacyCandidate.toObject()),
        isLegacy: !application,
        interviews: application?.interviews || [],
        timeline: application?.timeline || []
      },
      campaign,
      allApplications: finalApps
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRM TAGS
// ─────────────────────────────────────────────────────────────────────────────

router.post("/candidate/:id/tag", async (req, res) => {
  try {
    const { tag } = req.body;
    const candidate = await GlobalCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    
    if (!candidate.tags.includes(tag)) {
      candidate.tags.push(tag);
      await candidate.save();
    }
    res.json({ success: true, tags: candidate.tags });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/candidate/:id/toggle-silver", async (req, res) => {
  try {
    const candidate = await GlobalCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    
    candidate.isSilverMedalist = !candidate.isSilverMedalist;
    await candidate.save();
    res.json({ success: true, isSilverMedalist: candidate.isSilverMedalist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/interview
// Adds a new interview round to the candidate's latest application.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/interview", async (req, res) => {
  try {
    const { type, title, interviewerName, scheduledAt } = req.body;
    const { id } = req.params;

    // 1. Unify context resolution: Try Application first, then Legacy Candidate
    let doc = await JobApplication.findById(id);
    let isLegacy = false;

    if (!doc) {
      doc = await JobCandidate.findById(id);
      isLegacy = true;
    }

    if (!doc) return res.status(404).json({ error: "Record not found. Ensure ID is valid." });

    // 2. Add Interview Round
    doc.interviews = doc.interviews || [];
    doc.interviews.push({
      type: type || "Technical",
      title: title || `${type} Round`,
      interviewer: { name: interviewerName || "Hiring Team" },
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status: "Scheduled"
    });

    // 3. Update Timeline
    doc.timeline = doc.timeline || [];
    doc.timeline.push({
      event: "Interview Scheduled",
      date: new Date(),
      user: "System",
      details: `${title || type} scheduled`
    });

    await doc.save();
    res.json({ success: true, candidate: doc, isLegacy });
  } catch (err) {
    console.error("[POST /api/candidate/interview]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/interview/:roundId/feedback
// Submits scorecard for an interview round.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/interview/:roundId/feedback", async (req, res) => {
  try {
    const { rating, strengths, concerns, decision, interviewerName } = req.body;
    const { id, roundId } = req.params;

    // 1. Unify context resolution: Try Application first, then Legacy Candidate
    let doc = await JobApplication.findById(id);
    let isLegacy = false;

    if (!doc) {
      doc = await JobCandidate.findById(id);
      isLegacy = true;
    }

    if (!doc) return res.status(404).json({ error: "Record not found." });
    
    // 2. Resolve Interview Round
    const round = doc.interviews.id(roundId);
    if (!round) return res.status(404).json({ error: "Interview round not found." });

    // 3. Add Feedback
    round.feedback = round.feedback || [];
    round.feedback.push({
      interviewerName: interviewerName || "Hiring Team",
      rating: Number(rating) || 3,
      strengths: strengths || "",
      concerns: concerns || "",
      decision: decision || "Hold",
      submittedAt: new Date()
    });
    
    round.status = "Completed";

    // 4. Update Timeline
    doc.timeline = doc.timeline || [];
    doc.timeline.push({
      event: "Feedback Submitted",
      date: new Date(),
      user: interviewerName || "System",
      details: `${decision} rating (${rating}/5) for ${round.title || round.type}`
    });

    await doc.save();
    res.json({ success: true, candidate: doc, isLegacy });
  } catch (err) {
    console.error("[POST /api/candidate/feedback]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidate/:id/view-resume
// Generates a temporary signed URL for viewing private S3 resumes.
// Supports both fresh S3 URLs and legacy local /uploads/ paths.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id/view-resume", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    
    const url = candidate.resume_url;
    if (!url) return res.status(404).json({ error: "Resume URL not found." });

    // If it's an S3 URL (starts with https and contains s3)
    if (url.startsWith("http") && (url.includes("amazonaws.com") || url.includes(".s3"))) {
      try {
        const urlObj = new URL(url);
        // Decode the pathname AND replace '+' with ' ' because S3 keys are literal
        // but URLs often use '+' for spaces in some contexts.
        let s3Key = decodeURIComponent(urlObj.pathname.startsWith("/") ? urlObj.pathname.substring(1) : urlObj.pathname)
                    .replace(/\+/g, " ");
        
        // Safety: ensure we're using the bucket name from ENV, but handle cases where it might be in the host
        const bucket = (process.env.S3_BUCKET_NAME || "hire-buddy-resumes").trim();
        
        console.log(`[S3-PREVIEW] Generating signed URL. Bucket: "${bucket}", Key: "${s3Key}"`);
        
        const command = new GetObjectCommand({
          Bucket: bucket,
          Key: s3Key,
        });

        // Sign for 1 hour (3600 seconds)
        const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        console.log(`[S3-PREVIEW] Successfully generated signed URL for candidate ${req.params.id}`);
        return res.json({ success: true, signedUrl });
      } catch (s3Err) {
        console.error(`[S3-PREVIEW] Presign FAILED for candidate ${req.params.id}:`, s3Err.message);
        console.error(s3Err.stack);
        // DO NOT fallback to raw URL if it's private, return error instead
        return res.status(500).json({ success: false, error: "Presign failed: " + s3Err.message });
      }
    }

    // If it's a legacy local path (e.g. /uploads/filename.pdf)
    // We expect the frontend to handle this or we can provide a relative link
    res.json({ success: true, signedUrl: url });
  } catch (err) {
    console.error("[GET /view-resume]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/rename
// Body: { full_name }
// Manually updates a candidate's display name.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id/rename", async (req, res) => {
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) return res.status(400).json({ error: "Name is required." });
    
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    
    candidate.parsed_data = { ...(candidate.parsed_data || {}), full_name: full_name.trim() };
    await candidate.save();
    
    res.json({ success: true, full_name: candidate.parsed_data.full_name });
  } catch (err) {
    console.error("[PATCH /api/candidate/rename]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id
// Body: { final_decision?, final_score?, interview_stage? }
// Generic update route for candidate state.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id", async (req, res) => {
  try {
    const { final_decision, final_score, interview_stage } = req.body;
    const update = {};
    if (final_decision !== undefined) update.final_decision = final_decision;
    if (final_score !== undefined) update.final_score = final_score;
    if (interview_stage !== undefined) update.interview_stage = interview_stage;

    // 1. Try updating as an Application
    let record = await JobApplication.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    );

    // 2. If not found, try as a Legacy Candidate
    if (!record) {
      record = await JobCandidate.findByIdAndUpdate(
        req.params.id,
        update,
        { new: true }
      ).select("-rawText");
    }

    if (!record) return res.status(404).json({ error: "Record not found." });
    res.json({ success: true, candidate: record });
  } catch (err) {
    console.error("[PATCH /api/candidate]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/stage
// Body: { interview_stage }
// Advances a candidate through the interview pipeline.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id/stage", async (req, res) => {
  try {
    const { interview_stage } = req.body;
    let doc = await JobApplication.findById(req.params.id);
    
    if (doc) {
      // Fetch dynamic stages from campaign
      const campaign = await JobCampaign.findById(doc.jobId);
      const allowed = campaign?.pipeline_stages || ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
      
      if (!allowed.includes(interview_stage)) {
        return res.status(400).json({ error: `Invalid stage. Allowed: ${allowed.join(', ')}` });
      }

      // RELAXED State Machine: Allow jumping to Offer or Rejected
      const currentIndex = allowed.indexOf(doc.interview_stage || "Applied");
      const nextIndex = allowed.indexOf(interview_stage);
      
      if (interview_stage !== "Rejected" && interview_stage !== "Offer" && nextIndex < currentIndex) {
         return res.status(400).json({ error: "Cannot regress pipeline stages. Action restricted." });
      }

      const prevStage = doc.interview_stage || "Applied";
      doc.interview_stage = interview_stage;
      
      // Decision Mapping
      if (interview_stage === "Rejected") doc.final_decision = "NO";
      else if (interview_stage === "Offer" || interview_stage === "Hired") doc.final_decision = "STRONG_YES";
      else if (["Interview", "Screening"].includes(interview_stage)) {
        if (!doc.final_decision || doc.final_decision === "PENDING") doc.final_decision = "YES";
      }

      // Auto-log to timeline
      doc.timeline = doc.timeline || [];
      doc.timeline.push({
        event: "Stage Changed",
        date: new Date(),
        user: "System",
        details: `Moved from ${prevStage} to ${interview_stage}`
      });

      await doc.save();

      // Auto-close Headcount Logic
      if (interview_stage === "Hired" && campaign?.job_status === "Open") {
        const hireCount = await JobApplication.countDocuments({ jobId: campaign._id, interview_stage: "Hired" });
        if (hireCount >= campaign.positions) {
          campaign.job_status = "Closed";
          await campaign.save();
        }
      }

      return res.json({ success: true, candidate: doc, isLegacy: false });
    }

    // Try Legacy JobCandidate
    const legacyCand = await JobCandidate.findById(req.params.id);
    if (!legacyCand) return res.status(404).json({ error: "Candidate not found." });

    const prevStage = legacyCand.interview_stage || "Applied";
    legacyCand.interview_stage = interview_stage;

    // Decision Mapping
    if (interview_stage === "Rejected") legacyCand.final_decision = "NO";
    else if (interview_stage === "Offer" || interview_stage === "Hired") legacyCand.final_decision = "STRONG_YES";
    else if (["Interview", "Screening"].includes(interview_stage)) {
      if (!legacyCand.final_decision || legacyCand.final_decision === "PENDING") legacyCand.final_decision = "YES";
    }

    // Timeline Logging
    legacyCand.timeline = legacyCand.timeline || [];
    legacyCand.timeline.push({
      event: "Stage Changed",
      date: new Date(),
      user: "System",
      details: `Moved from ${prevStage} to ${interview_stage}`
    });

    await legacyCand.save();
    return res.json({ success: true, candidate: legacyCand, isLegacy: true });
  } catch (err) {
    console.error("[PATCH /api/candidate/stage]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/notes
// Body: { notes, tags? }
// Saves recruiter notes and optional tags to a candidate.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id/notes", async (req, res) => {
  try {
    const { notes, tags } = req.body;
    const update = {};
    if (notes !== undefined) update.notes = notes;
    if (tags !== undefined) update.tags = tags;
    const cand = await JobCandidate.findByIdAndUpdate(req.params.id, update, { new: true }).select("-rawText");
    if (!cand) return res.status(404).json({ error: "Candidate not found." });
    res.json({ success: true, candidate: cand });
  } catch (err) {
    console.error("[PATCH /api/candidate/notes]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidates/bulk
// Body: { ids: string[], action: "reject" | "stage", interview_stage? }
// Bulk operations on multiple candidates.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidates/bulk", async (req, res) => {
  try {
    const { ids, action, interview_stage } = req.body;
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required." });
    }
    let update = {};
    if (action === "reject") {
      update = { final_decision: "NO", interview_stage: "Rejected" };
    } else if (action === "stage" && interview_stage) {
      update = { interview_stage };
    } else {
      return res.status(400).json({ error: "Invalid action or missing interview_stage." });
    }
    await JobCandidate.updateMany({ _id: { $in: ids } }, update);
    res.json({ success: true, updated: ids.length });
  } catch (err) {
    console.error("[POST /api/candidates/bulk]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics
// Aggregates cross-campaign metrics for the analytics dashboard.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/analytics", async (req, res) => {
  try {
    const campaigns = await JobCampaign.find().sort({ createdAt: -1 });
    const allCandidates = await JobCandidate.find().select("-rawText");

    // Funnel: count candidates per interview stage
    const stages = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];
    const funnel = {};
    for (const s of stages) {
      funnel[s] = allCandidates.filter(c => c.interview_stage === s).length;
    }
    // Default: anyone without explicit stage is Applied
    funnel["Applied"] += allCandidates.filter(c => !c.interview_stage).length;

    // Decision distribution
    const decisions = { STRONG_YES: 0, YES: 0, MAYBE: 0, NO: 0, PENDING: 0 };
    for (const c of allCandidates) {
      if (c.final_decision && decisions[c.final_decision] !== undefined) {
        decisions[c.final_decision]++;
      } else if (!c.final_decision) {
        decisions.PENDING++;
      }
    }

    // Avg score per campaign
    const campaignScores = await Promise.all(campaigns.map(async (camp) => {
      const campCands = allCandidates.filter(c => c.campaignId?.toString() === camp._id.toString());
      const scored = campCands.filter(c => c.final_score != null);
      const avg = scored.length ? Math.round(scored.reduce((s, c) => s + c.final_score, 0) / scored.length) : null;
      return { id: camp._id, title: camp.title, department: camp.department, candidateCount: campCands.length, avgScore: avg };
    }));

    // Top demanded skills across all JD analyses
    const skillMap = {};
    for (const camp of campaigns) {
      const skills = camp.jd_analysis?.must_have_skills || camp.jd_analysis?.required_skills || [];
      for (const skill of skills) {
        const name = typeof skill === "string" ? skill : skill.name;
        if (name) skillMap[name] = (skillMap[name] || 0) + 1;
      }
    }
    const topSkills = Object.entries(skillMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // Conversion rates
    const totalCandidates = allCandidates.length;
    const shortlisted = allCandidates.filter(c => ["STRONG_YES", "YES"].includes(c.final_decision)).length;
    const interviewed = allCandidates.filter(c => c.interview_stage === "Interview").length;
    const hired = allCandidates.filter(c => c.interview_stage === "Hired").length;

    res.json({
      success: true,
      summary: {
        totalCampaigns: campaigns.length,
        totalCandidates,
        shortlisted,
        interviewed,
        hired,
        conversionRate: totalCandidates > 0 ? Math.round((shortlisted / totalCandidates) * 100) : 0,
      },
      funnel,
      decisions,
      campaignScores,
      topSkills,
    });
  } catch (err) {
    console.error("[GET /api/analytics]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/job/:id/public
// Public endpoint — returns campaign title, JD text, required skills.
// No auth required (used by public job application page).
// ─────────────────────────────────────────────────────────────────────────────
router.get("/job/:id/public", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id).select(
      "title job_title department generated_jd jd_analysis kanban_stage createdAt"
    );
    if (!campaign) return res.status(404).json({ error: "Job not found." });
    res.json({ success: true, campaign });
  } catch (err) {
    console.error("[GET /api/job/public]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/job/:id/apply
// Public endpoint — candidate submits application form + resume file.
// Form-data: name, email, phone, years_experience, resume (file)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/job/:id/apply", upload.single("resume"), async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Job not found." });

    // Check if applications are closed (stage moved past Sourcing)
    if (campaign.kanban_stage && campaign.kanban_stage !== "Sourcing") {
      return res.status(400).json({ error: "Applications for this role are now closed." });
    }

    if (!req.file) return res.status(400).json({ error: "Resume file is required." });

    const { name, email, phone, years_experience } = req.body;
    const rawText = await extractText(req.file);

    // Create candidate record
    const candidate = await JobCandidate.create({
      campaignId: campaign._id,
      fileName: req.file.originalname,
      full_name: name || cleanFileName(req.file.originalname),
      rawText,
      status: "UPLOADED",
      interview_stage: "Applied",
      parsed_data: {
        full_name: name || req.file.originalname,
        email: email || "",
        phone: phone || "",
        years_experience: Number(years_experience) || null,
      },
    });

    // --- S3 UPLOAD START ---
    try {
      console.log(`[S3] API/Apply: Uploading application from ${name || email} to ${process.env.S3_BUCKET_NAME || "hire-buddy-resumes"}`);
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const s3Key = `resumes/${uniqueSuffix}-${req.file.originalname}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME || "hire-buddy-resumes",
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      }));
      const s3Url = `https://${process.env.S3_BUCKET_NAME || "hire-buddy-resumes"}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${s3Key}`;
      console.log(`[S3] API/Apply: Success: ${s3Url}`);
      candidate.resume_url = s3Url;
      await candidate.save();
    } catch (s3Err) {
      console.error("[S3] API/Apply: Upload failed:", s3Err.message);
      // We continue since the record is already created with rawText
    }
    // --- S3 UPLOAD END ---

    // Trigger the automated 9-agent pipeline in the background
    runAutomatedPipeline(campaign._id).catch(err => {
      console.error("[apply-bg] Auto-pipeline failed:", err.message);
    });

    res.status(201).json({
      success: true,
      message: "Application submitted successfully!",
      candidateId: candidate._id,
    });
  } catch (err) {
    console.error("[POST /api/job/apply]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidate/:id/comments
// Returns all recruiter comments for a candidate.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id/comments", async (req, res) => {
  try {
    const comments = await Comment.find({ candidateId: req.params.id }).sort({ createdAt: 1 });
    res.json({ success: true, comments });
  } catch (err) {
    console.error("[GET /comments]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/comments
// Body: { author?, body }
// Adds a new comment to a candidate.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/comments", async (req, res) => {
  try {
    const { author, body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: "Comment body is required." });
    const comment = await Comment.create({
      candidateId: req.params.id,
      author: author?.trim() || "Recruiter",
      body: body.trim(),
    });
    res.status(201).json({ success: true, comment });
  } catch (err) {
    console.error("[POST /comments]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/interview-questions
// Generates tailored interview questions using Claude.
// Body: {} (pulls candidate + campaign data automatically)
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/interview-questions", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const campaign = await JobCampaign.findById(candidate.campaignId);

    const questions = await generateInterviewQuestions({
      candidateName: candidate.parsed_data?.full_name || candidate.fileName,
      candidateSkills: (candidate.validated_skills?.top_skills || []).map((s) =>
        typeof s === "string" ? s : s.name
      ),
      jdRequirements:
        campaign?.jd_analysis?.must_have_skills ||
        campaign?.jd_analysis?.required_skills ||
        [],
      jobTitle: campaign?.title || "the role",
    });

    // Cache on candidate record
    await JobCandidate.findByIdAndUpdate(req.params.id, { interview_questions: questions });

    res.json({ success: true, questions });
  } catch (err) {
    console.error("[POST /interview-questions]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/rejection-insight
// Generates a plain-English rejection explanation using Claude.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/rejection-insight", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    if (!candidate.final_decision) {
      return res.status(400).json({ error: "Candidate has not been evaluated yet." });
    }
    const campaign = await JobCampaign.findById(candidate.campaignId);

    const insight = await generateRejectionInsight({
      candidateName: candidate.parsed_data?.full_name || candidate.fileName,
      finalScore: candidate.final_score,
      finalDecision: candidate.final_decision,
      debateSummary: candidate.debate_summary,
      hrNote: candidate.hr_note,
      matchResults: candidate.match_results,
      validatedSkills: (candidate.validated_skills?.top_skills || []).map((s) =>
        typeof s === "string" ? s : s.name
      ),
      jdRequirements:
        campaign?.jd_analysis?.must_have_skills ||
        campaign?.jd_analysis?.required_skills ||
        [],
      jobTitle: campaign?.title || "the role",
    });

    // Cache on candidate
    await JobCandidate.findByIdAndUpdate(req.params.id, { rejection_insight: insight });

    res.json({ success: true, insight });
  } catch (err) {
    console.error("[POST /rejection-insight]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidates/all
// Returns all candidates across all campaigns in a single fast query.
// Used by the global candidate pool CRM page.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidates/all", async (req, res) => {
  try {
    const jobCandidates = await JobCandidate.find().select("-rawText").sort({ createdAt: -1 }).lean();
    const legacyCandidates = await Candidate.find().sort({ createdAt: -1 }).lean();

    // Mapping for legacy stages to Enterprise stages
    const STAGE_MAP = {
      'applied': 'Applied',
      'shortlisted': 'Screening',
      'interview': 'Interview',
      'offered': 'Offer',
      'hired': 'Hired',
      'rejected': 'Rejected'
    };

    // Enrich JobCandidates
    const campaignIds = [...new Set(jobCandidates.map(c => c.campaignId?.toString()).filter(Boolean))];
    const campaigns = await JobCampaign.find({ _id: { $in: campaignIds } })
      .select("title department kanban_stage status job_status createdAt")
      .lean();
    const campMap = {};
    for (const c of campaigns) campMap[c._id.toString()] = c;

    const enrichedEnterprise = jobCandidates.map(c => ({
      ...c,
      campaignTitle: campMap[c.campaignId?.toString()]?.title || "Unknown Role",
      campaignDept: campMap[c.campaignId?.toString()]?.department || "",
      campaignStatus: campMap[c.campaignId?.toString()]?.status || "",
      isLegacy: false
    }));

    // Normalize and Enrich Legacy Candidates
    const enrichedLegacy = legacyCandidates.map(c => ({
      _id: c._id,
      full_name: c.name || c.originalFileName?.replace(/\.[^/.]+$/, "") || "Candidate",
      campaignTitle: c.job || "Legacy Role",
      campaignDept: "General",
      final_score: c.totalScore || c.matchScore || c.score || 0,
      interview_stage: STAGE_MAP[c.stage] || "Applied",
      final_decision: c.stage === 'shortlisted' ? 'YES' : c.stage === 'rejected' ? 'NO' : 'PENDING',
      createdAt: c.createdAt,
      isLegacy: true,
      parsed_data: { email: "", phone: "", location: "" }, // Legacy might not have structured data
      validated_skills: { top_skills: [] }
    }));

    res.json({ 
      success: true, 
      candidates: [...enrichedEnterprise, ...enrichedLegacy], 
      total: jobCandidates.length + legacyCandidates.length 
    });
  } catch (err) {
    console.error("[GET /api/candidates/all]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/dashboard/alerts
// Returns smart alerts: stuck candidates, roles with no activity, high-priority.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/dashboard/alerts", async (req, res) => {
  try {
    const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Candidates stuck in same stage > 3 days (non-Hired/Rejected)
    const stuckCandidates = await JobCandidate.find({
      interview_stage: { $nin: ["Hired", "Rejected"] },
      updatedAt: { $lt: THREE_DAYS_AGO },
      status: "COMPLETED",
    }).select("full_name parsed_data fileName campaignId interview_stage updatedAt").limit(5).lean();

    const campIds = [...new Set(stuckCandidates.map(c => c.campaignId?.toString()).filter(Boolean))];
    const stuckCamps = await JobCampaign.find({ _id: { $in: campIds } }).select("title").lean();
    const stuckCampMap = {};
    for (const c of stuckCamps) stuckCampMap[c._id.toString()] = c.title;

    const stuckWithCamp = stuckCandidates.map(c => ({
      ...c,
      campaignTitle: stuckCampMap[c.campaignId?.toString()] || "Unknown Role",
      name: c.parsed_data?.full_name || c.full_name || c.fileName?.replace(/\.[^/.]+$/, "") || "Candidate",
    }));

    // Campaigns with no candidate activity in 7+ days (still open/sourcing)
    const inactiveCampaigns = await JobCampaign.find({
      kanban_stage: { $in: ["Sourcing", "Screening"] },
      createdAt: { $lt: SEVEN_DAYS_AGO },
    }).select("title department createdAt kanban_stage").limit(5).lean();

    // Campaigns with 0 candidates and > 2 days old
    const allCampaigns = await JobCampaign.find({ kanban_stage: { $nin: ["Hired"] } })
      .select("title department createdAt").lean();
    const emptyCampaigns = [];
    for (const camp of allCampaigns) {
      const count = await JobCandidate.countDocuments({ campaignId: camp._id });
      if (count === 0 && new Date(camp.createdAt) < THREE_DAYS_AGO) {
        emptyCampaigns.push(camp);
        if (emptyCampaigns.length >= 3) break;
      }
    }

    res.json({
      success: true,
      alerts: {
        stuckCandidates: stuckWithCamp,
        inactiveCampaigns,
        emptyCampaigns,
        total: stuckWithCamp.length + inactiveCampaigns.length + emptyCampaigns.length,
      },
    });
  } catch (err) {
    console.error("[GET /api/dashboard/alerts]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/toggle-silver
// Toggles silver medalist flag on a JobCandidate.
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/candidate/:id/toggle-silver", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    candidate.isSilverMedalist = !candidate.isSilverMedalist;
    await candidate.save();
    res.json({ success: true, isSilverMedalist: candidate.isSilverMedalist });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidate/:id/timeline
// Returns timeline events for a candidate's application journey.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id/timeline", async (req, res) => {
  try {
    // Check both JobApplication and JobCandidate
    const app = await JobApplication.findOne({ candidateId: req.params.id }).sort({ createdAt: -1 });
    if (app && app.timeline && app.timeline.length > 0) {
      return res.json({ success: true, timeline: app.timeline });
    }
    const candidate = await JobCandidate.findById(req.params.id).select("interview_stage createdAt updatedAt interview_questions");
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    // Build synthetic timeline from candidate data
    const timeline = [
      { event: "Application Received", date: candidate.createdAt, user: "System", details: "Resume uploaded and queued for evaluation" },
    ];
    if (candidate.interview_stage && candidate.interview_stage !== "Applied") {
      timeline.push({ event: `Moved to ${candidate.interview_stage}`, date: candidate.updatedAt, user: "System", details: `Current stage: ${candidate.interview_stage}` });
    }
    res.json({ success: true, timeline });
  } catch (err) {
    console.error("[GET /api/candidate/timeline]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ENTERPRISE WORKFLOW ROUTES
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/candidate/:id/activity
// POST /api/candidate/:id/activity
// Audit trail for every action on this candidate.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id/activity", async (req, res) => {
  try {
    const logs = await ActivityLog.find({ candidateId: req.params.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, activity: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/candidate/:id/activity", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id).select("campaignId");
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const { action, description, actor, metadata } = req.body;
    const log = await ActivityLog.create({
      candidateId: req.params.id,
      campaignId: candidate.campaignId,
      action: action || "NOTE_ADDED",
      description: description || "Manual entry",
      actor: actor || { name: "Recruiter", role: "Recruiter" },
      metadata: metadata || {},
    });
    res.status(201).json({ success: true, log });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/candidate/:id/stage/transition
// Validated stage transition with pipeline gate checks + auto-logs activity.
// Body: { toStage, actor: { name, role } }
//
// Gate rules:
//   → Offer:  at least 1 interview with feedback must exist
//   → Hired:  an approved Approval doc must exist
// ─────────────────────────────────────────────────────────────────────────────
const STAGE_ORDER = ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"];

router.patch("/candidate/:id/stage/transition", async (req, res) => {
  try {
    const { toStage, actor } = req.body;
    if (!toStage) return res.status(400).json({ error: "toStage is required." });

    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const fromStage = candidate.interview_stage;

    // ── Gate checks ─────────────────────────────────────────────
    if (toStage === "Offer") {
      const hasInterview = candidate.pipeline_validation?.interviews_completed > 0;
      const hasFeedback = candidate.pipeline_validation?.feedback_submitted;
      if (!hasInterview || !hasFeedback) {
        return res.status(422).json({
          error: "PIPELINE_GATE",
          message: "Cannot move to Offer: at least 1 completed interview with feedback is required.",
          missing: {
            interview: !hasInterview,
            feedback: !hasFeedback,
          },
        });
      }
    }

    if (toStage === "Hired") {
      const approval = await Approval.findOne({
        candidateId: req.params.id,
        status: "APPROVED",
      });
      if (!approval) {
        return res.status(422).json({
          error: "PIPELINE_GATE",
          message: "Cannot mark as Hired: offer approval is required first.",
          missing: { approval: true },
        });
      }
    }

    // ── Perform transition ───────────────────────────────────────
    const updates = { interview_stage: toStage };

    // Determine ownership after transition
    const ownerMap = {
      Screening: { name: "Recruiter", role: "Recruiter" },
      Interview: { name: "Interviewer", role: "Interviewer" },
      Offer:     { name: "Hiring Manager", role: "HiringManager" },
      Hired:     { name: "HR", role: "Recruiter" },
      Rejected:  { name: "System", role: "Recruiter" },
    };
    if (ownerMap[toStage]) updates.current_owner = ownerMap[toStage];

    // Mark completed when terminal
    if (toStage === "Hired" || toStage === "Rejected") {
      updates.candidate_status = "COMPLETED";
    } else {
      updates.candidate_status = "ACTIVE";
    }

    await JobCandidate.findByIdAndUpdate(req.params.id, updates);

    // ── Write audit log ──────────────────────────────────────────
    const actorInfo = actor || { name: "Recruiter", role: "Recruiter" };
    await ActivityLog.create({
      candidateId: req.params.id,
      campaignId: candidate.campaignId,
      action: toStage === "Rejected" ? "CANDIDATE_REJECTED" : "STAGE_CHANGE",
      fromStage,
      toStage,
      actor: actorInfo,
      description: `Moved from ${fromStage} → ${toStage} by ${actorInfo.name}`,
    });

    // ── Auto-create follow-up task ────────────────────────────────
    const taskMap = {
      Screening:  { type: "REVIEW_APPLICATION",  title: "Review candidate application",      priority: "MEDIUM" },
      Interview:  { type: "SCHEDULE_INTERVIEW",   title: "Schedule technical interview",       priority: "HIGH" },
      Offer:      { type: "APPROVE_OFFER",        title: "Create and request offer approval",  priority: "HIGH" },
    };
    if (taskMap[toStage]) {
      await Task.create({
        candidateId: req.params.id,
        campaignId: candidate.campaignId,
        ...taskMap[toStage],
        assignedTo: ownerMap[toStage] || { name: "Recruiter", role: "Recruiter" },
        triggerStage: toStage,
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days
      });
    }

    res.json({
      success: true,
      fromStage,
      toStage,
      candidate_status: updates.candidate_status,
    });
  } catch (err) {
    console.error("[PATCH /candidate/stage/transition]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET  /api/candidate/:id/tasks  — list all tasks for a candidate
// POST /api/candidate/:id/tasks  — create a task for a candidate
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id/tasks", async (req, res) => {
  try {
    const tasks = await Task.find({ candidateId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/candidate/:id/tasks", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id).select("campaignId");
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const { type, title, description, assignedTo, priority, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: "title is required." });

    const task = await Task.create({
      candidateId: req.params.id,
      campaignId: candidate.campaignId,
      type: type || "CUSTOM",
      title,
      description: description || "",
      assignedTo: assignedTo || { name: "Recruiter", role: "Recruiter" },
      priority: priority || "MEDIUM",
      dueDate: dueDate ? new Date(dueDate) : null,
    });

    // Log activity
    await ActivityLog.create({
      candidateId: req.params.id,
      campaignId: candidate.campaignId,
      action: "TASK_CREATED",
      description: `Task created: "${title}"`,
      actor: assignedTo || { name: "Recruiter", role: "Recruiter" },
      metadata: { taskId: task._id, taskType: type },
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/task/:id/complete  — mark a task as completed
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/task/:id/complete", async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found." });

    task.status = "COMPLETED";
    task.completedAt = new Date();
    task.completedBy = req.body.completedBy || "Recruiter";
    await task.save();

    // Log activity
    await ActivityLog.create({
      candidateId: task.candidateId,
      campaignId: task.campaignId,
      action: "TASK_COMPLETED",
      description: `Task completed: "${task.title}"`,
      actor: { name: req.body.completedBy || "Recruiter", role: "Recruiter" },
      metadata: { taskId: task._id },
    });

    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tasks/pending  — dashboard widget: all pending tasks
// ─────────────────────────────────────────────────────────────────────────────
router.get("/tasks/pending", async (req, res) => {
  try {
    const tasks = await Task.find({ status: "PENDING" })
      .sort({ priority: 1, dueDate: 1, createdAt: -1 })
      .limit(20)
      .lean();

    // Enrich with candidate names
    const candIds = [...new Set(tasks.map((t) => t.candidateId?.toString()).filter(Boolean))];
    const candidates = await JobCandidate.find({ _id: { $in: candIds } })
      .select("parsed_data full_name fileName")
      .lean();
    const candMap = {};
    for (const c of candidates) {
      candMap[c._id.toString()] = c.parsed_data?.full_name || c.full_name || cleanFileName(c.fileName);
    }

    const enriched = tasks.map((t) => ({
      ...t,
      candidateName: candMap[t.candidateId?.toString()] || "Candidate",
    }));

    res.json({ success: true, tasks: enriched });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/approval  — create an offer approval request
// Body: { offerDetails: { salary, startDate, position, location, notes }, requestedBy }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/approval", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id).select("campaignId interview_stage");
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    const { offerDetails, requestedBy, approvers } = req.body;

    // Default approvers: Hiring Manager + HR
    const defaultApprovers = approvers || [
      { name: "Hiring Manager", role: "HiringManager" },
      { name: "HR Lead", role: "HR" },
    ];

    const approval = await Approval.create({
      candidateId: req.params.id,
      campaignId: candidate.campaignId,
      type: "OFFER_APPROVAL",
      requestedBy: requestedBy || { name: "Recruiter", role: "Recruiter" },
      offerDetails: offerDetails || {},
      approvers: defaultApprovers.map((a) => ({ ...a, status: "PENDING" })),
      status: "PENDING",
    });

    // Move candidate to NEEDS_ACTION (awaiting approval)
    await JobCandidate.findByIdAndUpdate(req.params.id, {
      candidate_status: "NEEDS_ACTION",
      "pipeline_validation.offer_approved": false,
    });

    // Log activity
    await ActivityLog.create({
      candidateId: req.params.id,
      campaignId: candidate.campaignId,
      action: "APPROVAL_REQUESTED",
      description: `Offer approval requested by ${requestedBy?.name || "Recruiter"}`,
      actor: requestedBy || { name: "Recruiter", role: "Recruiter" },
      metadata: { approvalId: approval._id, offerDetails },
    });

    // Create "Approve Offer" tasks for each approver
    for (const approver of defaultApprovers) {
      await Task.create({
        candidateId: req.params.id,
        campaignId: candidate.campaignId,
        type: "APPROVE_OFFER",
        title: `Approve offer for candidate`,
        assignedTo: { name: approver.name, role: approver.role },
        priority: "HIGH",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 1 day
      });
    }

    res.status(201).json({ success: true, approval });
  } catch (err) {
    console.error("[POST /candidate/approval]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/candidate/:id/approvals  — get all approval requests for a candidate
// ─────────────────────────────────────────────────────────────────────────────
router.get("/candidate/:id/approvals", async (req, res) => {
  try {
    const approvals = await Approval.find({ candidateId: req.params.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, approvals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/approval/:id/decide
// Body: { approverName, decision: 'APPROVED'|'REJECTED', note }
// Individual approver casts their vote; if all approve → status = APPROVED
// ─────────────────────────────────────────────────────────────────────────────
router.patch("/approval/:id/decide", async (req, res) => {
  try {
    const { approverName, decision, note } = req.body;
    if (!approverName || !decision) {
      return res.status(400).json({ error: "approverName and decision are required." });
    }

    const approval = await Approval.findById(req.params.id);
    if (!approval) return res.status(404).json({ error: "Approval not found." });
    if (approval.status === "APPROVED" || approval.status === "REJECTED") {
      return res.status(409).json({ error: "Approval already finalized." });
    }

    // Find and update the specific approver entry
    const approverIdx = approval.approvers.findIndex((a) => a.name === approverName);
    if (approverIdx === -1) {
      return res.status(404).json({ error: "Approver not found in this request." });
    }

    approval.approvers[approverIdx].status = decision;
    approval.approvers[approverIdx].decidedAt = new Date();
    approval.approvers[approverIdx].note = note || "";

    approval.recomputeStatus();
    await approval.save();

    // If fully approved, update candidate flags
    if (approval.status === "APPROVED") {
      await JobCandidate.findByIdAndUpdate(approval.candidateId, {
        candidate_status: "ACTIVE",
        "pipeline_validation.offer_approved": true,
      });
    }

    // Log activity
    await ActivityLog.create({
      candidateId: approval.candidateId,
      campaignId: approval.campaignId,
      action: "APPROVAL_DECIDED",
      description: `${approverName} ${decision === "APPROVED" ? "approved" : "rejected"} the offer`,
      actor: { name: approverName, role: "HiringManager" },
      metadata: { approvalId: approval._id, decision, note },
    });

    res.json({ success: true, approval });
  } catch (err) {
    console.error("[PATCH /approval/decide]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/activity  (already defined above, this is a hook)
// PATCH /api/candidate/:id/notes — enhanced to also write activity log
// Override the existing notes route to log the save action.
// ─────────────────────────────────────────────────────────────────────────────
// (Notes route already exists in the file — we add a post-save activity log
//  by patching the stage-change route to also call ActivityLog.create.
//  The existing notes PATCH in the file handles persistence fine.)

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/interview — enhanced to update pipeline_validation
// (route already exists; we need a small patch via a pre-save hook)
// Add a separate endpoint to sync pipeline_validation counts.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/pipeline/sync", async (req, res) => {
  try {
    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });

    // Count interviews with at least one feedback entry
    const app = await JobApplication.findOne({ candidateId: req.params.id });
    let completedInterviews = 0;
    let hasFeedback = false;

    if (app && app.interviews) {
      completedInterviews = app.interviews.filter(
        (i) => i.status === "Completed" || (i.feedback && i.feedback.length > 0)
      ).length;
      hasFeedback = app.interviews.some((i) => i.feedback && i.feedback.length > 0);
    }

    // Also check JobCandidate.interviews if stored there
    if (candidate.interviews) {
      const candInterviews = candidate.interviews || [];
      completedInterviews = Math.max(
        completedInterviews,
        candInterviews.filter((i) => i.feedback && i.feedback.length > 0).length
      );
      hasFeedback = hasFeedback || candInterviews.some((i) => i.feedback && i.feedback.length > 0);
    }

    await JobCandidate.findByIdAndUpdate(req.params.id, {
      "pipeline_validation.interviews_completed": completedInterviews,
      "pipeline_validation.feedback_submitted": hasFeedback,
    });

    res.json({
      success: true,
      pipeline_validation: {
        interviews_completed: completedInterviews,
        feedback_submitted: hasFeedback,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/candidate/:id/ask
// Custom query endpoint for recruiter-assistant interaction.
// Body: { question }
// ─────────────────────────────────────────────────────────────────────────────
router.post("/candidate/:id/ask", async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question is required." });

    const candidate = await JobCandidate.findById(req.params.id);
    if (!candidate) return res.status(404).json({ error: "Candidate not found." });
    const campaign = await JobCampaign.findById(candidate.campaignId);

    const result = await queryCandidate({
      candidateName: candidate.parsed_data?.full_name || candidate.fileName,
      candidateData: candidate,
      jobDescription: campaign?.generated_jd || "N/A",
      question,
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[POST /candidate/ask]", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/campaign/:id/recommend
// Generates an AI hiring recommendation for the top candidates in a campaign.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/campaign/:id/recommend", async (req, res) => {
  try {
    const campaign = await JobCampaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ error: "Campaign not found." });

    const candidates = await JobCandidate.find({ campaignId: req.params.id, status: "COMPLETED" })
      .select("-rawText")
      .sort({ final_score: -1 })
      .limit(5);

    if (candidates.length < 2) {
      return res.status(400).json({ error: "Need at least 2 evaluated candidates to generate a recommendation." });
    }

    const recommendation = await generateRecommendation({
      candidates,
      jobTitle: campaign.title,
      jdRequirements:
        campaign.jd_analysis?.must_have_skills ||
        campaign.jd_analysis?.required_skills ||
        [],
    });

    // Cache on campaign
    await JobCampaign.findByIdAndUpdate(req.params.id, { ai_recommendation: recommendation });

    res.json({ success: true, recommendation });
  } catch (err) {
    console.error("[POST /campaign/recommend]", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
