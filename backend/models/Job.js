const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String },
  location: { type: String },
  type: { type: String, default: "Full-time" },
  experienceYears: { type: Number },
  description: { type: String, required: true },
  skills: [String],
  recruiter: { type: mongoose.Schema.Types.ObjectId, ref: "Recruiter" },
  status: {
    type: String,
    enum: ["active", "paused", "draft", "closed"],
    default: "active"
  },
  applicantCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Job", jobSchema);

