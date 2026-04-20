const mongoose = require("mongoose");

/**
 * ActivityLog — Immutable audit trail for every hiring action.
 * Every stage change, feedback submission, note save, approval decision,
 * and task completion writes an entry here.
 */
const ActivityLogSchema = new mongoose.Schema(
  {
    candidateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCandidate",
      required: true,
      index: true,
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobCampaign",
      index: true,
    },
    action: {
      type: String,
      enum: [
        "STAGE_CHANGE",
        "FEEDBACK_SUBMITTED",
        "NOTE_ADDED",
        "TAG_ADDED",
        "OFFER_CREATED",
        "APPROVAL_REQUESTED",
        "APPROVAL_DECIDED",
        "TASK_CREATED",
        "TASK_COMPLETED",
        "INTERVIEW_SCHEDULED",
        "CANDIDATE_SHORTLISTED",
        "CANDIDATE_REJECTED",
        "SILVER_MEDAL_TOGGLED",
        "COMMENT_ADDED",
        "AI_EVALUATED",
        "CANDIDATE_UPLOADED",
        "DECISION_CHANGED",
        "PIPELINE_BLOCKED",
      ],
      required: true,
    },
    fromStage: { type: String, default: null },
    toStage: { type: String, default: null },
    actor: {
      name: { type: String, default: "Recruiter" },
      role: {
        type: String,
        enum: ["Recruiter", "Interviewer", "HiringManager", "Admin", "System"],
        default: "Recruiter",
      },
    },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    // Logs are immutable — no updates
  }
);

// Sorted by newest first by default
ActivityLogSchema.index({ candidateId: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
