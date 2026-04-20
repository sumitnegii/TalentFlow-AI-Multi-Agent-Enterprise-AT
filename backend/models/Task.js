const mongoose = require("mongoose");

/**
 * Task — Hiring workflow task assigned to a person/role.
 * Tracks what needs to happen next for a candidate.
 * Examples: "Schedule Technical Interview", "Submit Feedback", "Approve Offer"
 */
const TaskSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: [
        "SCHEDULE_INTERVIEW",
        "SUBMIT_FEEDBACK",
        "APPROVE_OFFER",
        "REVIEW_APPLICATION",
        "SEND_OFFER_LETTER",
        "BACKGROUND_CHECK",
        "REFERENCE_CHECK",
        "ONBOARDING_DOCS",
        "CUSTOM",
      ],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assignedTo: {
      name: { type: String, default: "Recruiter" },
      role: {
        type: String,
        enum: ["Recruiter", "Interviewer", "HiringManager", "Admin"],
        default: "Recruiter",
      },
      email: { type: String, default: "" },
    },
    priority: {
      type: String,
      enum: ["HIGH", "MEDIUM", "LOW"],
      default: "MEDIUM",
    },
    status: {
      type: String,
      enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
      default: "PENDING",
    },
    dueDate: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: String, default: null },
    // Link to the stage that triggered this task
    triggerStage: { type: String, default: null },
  },
  { timestamps: true }
);

TaskSchema.index({ candidateId: 1, status: 1 });
TaskSchema.index({ status: 1, createdAt: -1 }); // for dashboard pending tasks query

module.exports = mongoose.model("Task", TaskSchema);
