const mongoose = require("mongoose");

const JobCampaignSchema = new mongoose.Schema({
  title: { type: String, required: true },
  jd_id: { type: String, unique: true },
  job_title: { type: String, default: "" },
  department: { type: String, default: "General" },
  status: {
    type: String,
    enum: ["Draft", "Sourcing", "Evaluating", "Completed"],
    default: "Draft",
  },
  // Kanban pipeline stage of the entire campaign
  kanban_stage: {
    type: String,
    enum: ["Sourcing", "Screening", "Interview", "Offer", "Hired"],
    default: "Sourcing",
  },
  // Configurable pipeline stages for this role
  pipeline_stages: {
    type: [String],
    default: [
      "Applied",
      "Resume Screening",
      "Recruiter Call",
      "Technical Round 1",
      "Technical Round 2",
      "Hiring Manager",
      "HR Round",
      "Offer",
      "Hired",
      "Rejected"
    ]
  },
  generated_jd: { type: String },
  jd_analysis: { type: Object },
  // Suggested interview questions (generated with JD)
  interview_questions: [{ type: String }],
  // AI hiring recommendation (cached)
  ai_recommendation: { type: Object, default: null },
  positions: { type: Number, default: 1 },
  job_status: { 
    type: String, 
    enum: ["Open", "Closed"], 
    default: "Open" 
  },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("JobCampaign", JobCampaignSchema);
