const mongoose = require("mongoose");

const CandidateSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true
  },
  recruiterId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recruiter",
    index: true
  },
  name: String,
  originalFileName: String,
  groupName: {
    type: String,
    trim: true,
    default: ""
  },
  job: String,
  score: Number,
  technicalScore: {
    type: Number,
    default: 0
  },
  softwareSoftSkillsScore: {
    type: Number,
    default: 0
  },
  experienceMatch: {
    type: Number,
    default: 0
  },
  projectRelevance: {
    type: Number,
    default: 0
  },
  educationMatch: {
    type: Number,
    default: 0
  },
  totalScore: {
    type: Number,
    default: 0
  },
  finalScore: {
    type: Number,
    default: 0
  },
  matchPercentage: {
    type: Number,
    default: 0
  },
  scoringVersion: {
    type: Number
  },
  remarks: {
    type: String,
    default: ""
  },
  matchScore: { type: Number },
  strengths: [String],
  gaps: [String],
  recommendation: { type: String, enum: ["shortlist", "review", "reject"] },
  scoreSummary: String,
  scoredForJob: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
  cvText: String,
  stage: {
    type: String,
    enum: ["applied", "shortlisted", "interview", "offered", "rejected"],
    default: "applied"
  },
  scoringWeights: {
    technicalSkills: {
      type: Number,
      default: 30
    },
    softwareSoftSkills: {
      type: Number,
      default: 20
    },
    experience: {
      type: Number,
      default: 20
    },
    projects: {
      type: Number,
      default: 15
    },
    educationCertification: {
      type: Number,
      default: 15
    }
  },
  resumeText: String,
  resumeMimeType: String,
  resumeUrl: String,
  resumeFile: Buffer
}, { timestamps: true });

module.exports = mongoose.model("Candidate",CandidateSchema);
