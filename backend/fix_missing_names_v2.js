const mongoose = require("mongoose");
const JobCandidate = require("./models/JobCandidate");
const extractIdentity = require("./lib/agents/identityExtractor");
require("dotenv").config();

function cleanFileName(fileName) {
  if (!fileName) return "Unknown Candidate";
  let name = fileName.replace(/\.[^/.]+$/, "");
  name = name.replace(/WhatsApp Image \d{4}-\d{2}-\d{2} at \d{1,2}\.\d{2}\.\d{2}/g, "");
  name = name.replace(/ \(\d+\)/g, "");
  name = name.replace(/^(Scan|Image|Resume|CV|Document)[_\-\s]*/i, "");
  name = name.replace(/[_\-]+/g, " ").replace(/\s\s+/g, " ").trim();
  return name || "Candidate";
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  
  // Find candidates with messy names or nulls
  const candidates = await JobCandidate.find({
    $or: [
      { "parsed_data.full_name": { $exists: false } },
      { "parsed_data.full_name": null },
      { "parsed_data.full_name": /whatsapp/i },
      { "parsed_data.full_name": /\.pdf$/i },
      { "parsed_data.full_name": "" }
    ]
  });

  console.log(`Found ${candidates.length} candidates needing name extraction/cleanup...`);

  for (const c of candidates) {
    try {
      console.log(`Processing: ${c.fileName}...`);
      
      // Step 1: Try AI Extraction
      const identityData = await extractIdentity(c.rawText).catch(() => ({}));
      
      // Step 2: Set Name (AI > Cleaned Filename)
      const finalName = identityData.full_name || cleanFileName(c.fileName);
      console.log(`  -> Resolved to: ${finalName}`);

      c.parsed_data = { ...(c.parsed_data || {}), ...identityData, full_name: finalName };
      await c.save();
    } catch (err) {
      console.error(`  !! Error processing ${c.fileName}:`, err.message);
    }
  }

  console.log("SUCCESS: Smart Name Extraction Migration complete.");
  process.exit(0);
}

run();
