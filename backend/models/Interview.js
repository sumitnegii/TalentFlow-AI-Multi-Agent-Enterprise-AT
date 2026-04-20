const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema({
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Candidate",
    required: true
  },
  job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recruiter",
    required: true
  },
  scheduledAt: { type: Date, required: true },
  durationMinutes: { type: Number, default: 45 },
  type: {
    type: String,
    enum: ["video", "phone", "in-person"],
    default: "video"
  },
  round: { type: String, default: "Round 1" },
  meetLink: { type: String },
  notes: { type: String },
  status: {
    type: String,
    enum: ["scheduled", "confirmed", "completed", "cancelled", "pending"],
    default: "scheduled"
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Interview", interviewSchema);

