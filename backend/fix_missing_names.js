const mongoose = require("mongoose");
const JobCandidate = require("./models/JobCandidate");
const extractIdentity = require("./lib/agents/identityExtractor");
require("dotenv").config();

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Find candidates where name is likely just the filename or null
  const candidates = await JobCandidate.find({
    $or: [
      { "parsed_data.full_name": { $exists: false } },
      { "parsed_data.full_name": null },
      { "parsed_data.full_name": /whatsapp/i },
      { "parsed_data.full_name": /\.pdf$/i },
      { "parsed_data.full_name": "" }
    ]
  });

  console.log(`Found ${candidates.length} candidates needing name extraction fix...`);

  for (const c of candidates) {
    try {
      console.log(`Extracting real name for: ${c.fileName}...`);
      const identityData = await extractIdentity(c.rawText);
      console.log(`  -> Found: ${identityData.full_name}`);

      c.parsed_data = { ...c.parsed_data, ...identityData };
      await c.save();
    } catch (err) {
      console.error(`  !! Error processing ${c.fileName}:`, err.message);
    }
  }

  console.log("SUCCESS: Identity fix migration complete.");
  process.exit(0);
}

run();
