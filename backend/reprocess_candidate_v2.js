const mongoose = require("mongoose");
const JobCandidate = require("./models/JobCandidate");
const extractIdentity = require("./lib/agents/identityExtractor");
const cvValidator = require("./lib/agents/cvValidator");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const candidate = await JobCandidate.findById("69dcba2dcf64677d2fc64563");
  if (!candidate) return console.log("Not found");

  console.log("Reprocessing candidate:", candidate.fileName);
  
  // Step A: Extract Identity
  const identityData = await extractIdentity(candidate.rawText);
  console.log("Identity Extracted:", identityData);

  // Step B: Extract Capability (Precision Experience)
  const { parsed_data, validated_skills } = await cvValidator(candidate.rawText);
  console.log("Capability Parsed (Years):", parsed_data.experience_years);
  console.log("Is Fresher:", parsed_data.is_fresher);

  candidate.parsed_data = { ...parsed_data, ...identityData };
  candidate.validated_skills = validated_skills;
  await candidate.save();
  
  console.log("SUCCESS: Candidate reprocessed with precision logic.");
  process.exit(0);
}

run();
