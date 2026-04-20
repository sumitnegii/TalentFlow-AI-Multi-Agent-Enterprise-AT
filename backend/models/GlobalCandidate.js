const mongoose = require("mongoose");

const GlobalCandidateSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  phone: { type: String, default: "" },
  name: { type: String, default: "" },
  
  // Latest identity/bio data (Agent 3+4 results)
  parsed_data: Object,
  validated_skills: Object,
  
  // Primary/Latest resume info
  resume_url: { type: String, default: "" },
  rawText: String,
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  
  // CRM Attributes
  tags: { type: [String], default: [] },
  isSilverMedalist: { type: Boolean, default: false }
});

module.exports = mongoose.model("GlobalCandidate", GlobalCandidateSchema);
