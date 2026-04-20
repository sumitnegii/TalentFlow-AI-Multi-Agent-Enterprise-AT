const mongoose = require("mongoose");

const JobCandidateSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "JobCampaign",
    required: true,
  },
  fileName: { type: String, required: true },
  full_name: { type: String, default: "" },
  status: {
    type: String,
    enum: ["UPLOADED", "AGENT_3_4_DONE", "AGENT_5_DONE", "AGENT_6_7_DONE", "COMPLETED"],
    default: "UPLOADED",
  },
  rawText: String,

  // Agent 3 & 4 (Combined Parse + Skill Validation)
  parsed_data: Object,
  validated_skills: Object,

  // Agent 5 (Match Engine)
  match_score: Number,
  match_results: Object,

  // Agent 6 & 7 (Counter + Debate Reconciliation)
  counter_analysis: Object,
  corrected_score: Number,
  debate_summary: String,
  final_score: Number,
  final_decision: String, // STRONG_YES | YES | MAYBE | NO

  // Agent 8 (Ranking Engine — native JS sort)
  rank: { type: Number, default: 0 },

  // Agent 9 (HR Final Review)
  hr_note: String,

  // ── NEW: Interview Pipeline ───────────────────────────────────
  interview_stage: {
    type: String,
    enum: ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"],
    default: "Applied",
  },

  // ── NEW: Recruiter Notes & Tags ──────────────────────────────
  notes: { type: String, default: "" },
  tags: [{ type: String }],
  ai_summary: { type: String, default: "" },

  // ── NEW: AI-generated Interview Questions (cached) ───────────
  interview_questions: { type: Object, default: null },

  // ── NEW: AI Rejection Insight (cached) ───────────────────────
  rejection_insight: { type: Object, default: null },

  // ── CRM FLAGS ────────────────────────────────────────────────
  isSilverMedalist: { type: Boolean, default: false },
  resume_url: { type: String, default: "" },

  // ── ENTERPRISE: Pipeline Status ───────────────────────────────
  // ACTIVE = moving normally | BLOCKED = missing info | NEEDS_ACTION = recruiter action required
  candidate_status: {
    type: String,
    enum: ["ACTIVE", "BLOCKED", "NEEDS_ACTION", "COMPLETED"],
    default: "ACTIVE",
  },
  blocked_reason: { type: String, default: "" },
  current_owner: {
    name: { type: String, default: "Recruiter" },
    role: {
      type: String,
      enum: ["Recruiter", "Interviewer", "HiringManager", "Admin"],
      default: "Recruiter",
    },
  },

  // ── ENTERPRISE: Pipeline Validation ──────────────────────────
  // Tracked server-side so stage gates can be enforced.
  pipeline_validation: {
    interviews_required: { type: Number, default: 1 },
    interviews_completed: { type: Number, default: 0 },
    feedback_submitted: { type: Boolean, default: false },
    offer_approved: { type: Boolean, default: false },
  },

  // ── NEW: Timeline & Interview Records ──────────────────────────
  interviews: [{
    type: { type: String, enum: ["Technical", "HR", "System Design", "Behavioral", "Hiring Manager", "Culture Fit", "Other"], default: "Technical" },
    title: { type: String, default: "Technical Screening" },
    interviewer: {
      id: mongoose.Schema.Types.ObjectId,
      name: String
    },
    scheduledAt: Date,
    status: { type: String, enum: ["Pending", "Scheduled", "Completed", "No-show"], default: "Pending" },
    feedback: [{
      interviewerId: mongoose.Schema.Types.ObjectId,
      interviewerName: String,
      rating: { type: Number, min: 1, max: 5 },
      strengths: String,
      concerns: String,
      decision: { type: String, enum: ["Hire", "No Hire", "Hold"] },
      submittedAt: { type: Date, default: Date.now }
    }],
    createdAt: { type: Date, default: Date.now }
  }],

  timeline: [{
    event: String, 
    date: { type: Date, default: Date.now },
    user: { type: String, default: "System" },
    details: String
  }],

  // ── LEGACY HANDLING ──────────────────────────────────────────
  isLegacy: { type: Boolean, default: true },

  createdAt: { type: Date, default: Date.now },
});

// Virtual to expose campaignId as job_id for API consistency
JobCandidateSchema.virtual("job_id").get(function () {
  return this.campaignId;
});

JobCandidateSchema.set("toJSON", { virtuals: true });
JobCandidateSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("JobCandidate", JobCandidateSchema);
