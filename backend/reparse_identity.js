const mongoose = require("mongoose");
const JobCandidate = require("./models/JobCandidate");
const extractIdentity = require("./lib/agents/identityExtractor");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  const candidate = await JobCandidate.findById("69dcba2dcf64677d2fc64563");
  if (!candidate) return console.log("Not found");

  console.log("Reparsing identity for:", candidate.fileName);
  const identityData = await extractIdentity(candidate.rawText);
  console.log("Extracted:", identityData);

  candidate.parsed_data = { ...candidate.parsed_data, ...identityData };
  await candidate.save();
  console.log("Saved!");
  process.exit(0);
}

run();
