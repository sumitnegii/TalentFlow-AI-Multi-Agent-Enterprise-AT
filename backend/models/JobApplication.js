const mongoose = require("mongoose");

const JobApplicationSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GlobalCandidate",
    required: true,
  },
  jobId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "JobCampaign",
    required: true,
  },
  
  status: {
    type: String,
    enum: ["UPLOADED", "AGENT_3_4_DONE", "AGENT_5_DONE", "AGENT_6_7_DONE", "COMPLETED"],
    default: "UPLOADED",
  },

  // Role-specific evaluation (Agent 5-9)
  match_score: Number,
  match_results: Object,
  counter_analysis: Object,
  corrected_score: Number,
  debate_summary: String,
  final_score: Number,
  final_decision: String, // STRONG_YES | YES | MAYBE | NO
  
  rank: { type: Number, default: 0 },
  hr_note: String,
  
  interview_stage: {
    type: String,
    enum: ["Applied", "Screening", "Interview", "Offer", "Hired", "Rejected"],
    default: "Applied",
  },

  notes: { type: String, default: "" },
  tags: [{ type: String }],
  ai_summary: { type: String, default: "" },
  
  // New Enterprise Features
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
    event: String, // e.g. "Stage Changed", "Interview Scheduled", "Feedback Added"
    date: { type: Date, default: Date.now },
    user: { type: String, default: "System" },
    details: String
  }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("JobApplication", JobApplicationSchema);
