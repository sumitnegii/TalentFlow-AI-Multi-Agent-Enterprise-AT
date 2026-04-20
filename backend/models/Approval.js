const mongoose = require("mongoose");

/**
 * Approval — Offer/Hire approval request requiring sign-off.
 * When a candidate reaches Offer stage, a recruiter creates an approval request.
 * Hiring Manager (and optionally HR) must approve before the offer is sent.
 */
const ApprovalSchema = new mongoose.Schema(
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
      enum: ["OFFER_APPROVAL", "HIRE_APPROVAL"],
      default: "OFFER_APPROVAL",
    },
    requestedBy: {
      name: { type: String, default: "Recruiter" },
      role: { type: String, default: "Recruiter" },
    },
    offerDetails: {
      salary: { type: String, default: "" },
      startDate: { type: String, default: "" },
      position: { type: String, default: "" },
      location: { type: String, default: "On-site" },
      employmentType: { type: String, default: "Full-time" },
      notes: { type: String, default: "" },
    },
    approvers: [
      {
        name: { type: String, required: true },
        role: {
          type: String,
          enum: ["HiringManager", "HR", "Admin", "CFO"],
          default: "HiringManager",
        },
        status: {
          type: String,
          enum: ["PENDING", "APPROVED", "REJECTED"],
          default: "PENDING",
        },
        decidedAt: { type: Date, default: null },
        note: { type: String, default: "" },
      },
    ],
    // Overall status — computed from approvers
    status: {
      type: String,
      enum: ["PENDING", "PARTIALLY_APPROVED", "APPROVED", "REJECTED", "WITHDRAWN"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

// Recompute overall status when approvers change
ApprovalSchema.methods.recomputeStatus = function () {
  const approvers = this.approvers;
  if (!approvers || approvers.length === 0) return;
  if (approvers.some((a) => a.status === "REJECTED")) {
    this.status = "REJECTED";
  } else if (approvers.every((a) => a.status === "APPROVED")) {
    this.status = "APPROVED";
  } else if (approvers.some((a) => a.status === "APPROVED")) {
    this.status = "PARTIALLY_APPROVED";
  } else {
    this.status = "PENDING";
  }
};

module.exports = mongoose.model("Approval", ApprovalSchema);
