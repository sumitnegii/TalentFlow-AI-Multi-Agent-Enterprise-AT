const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const Groq = require("groq-sdk");
const Job = require("../models/Job");
const auth = require("../middleware/auth");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function getGroqClient() {
  if (!process.env.GROQ_API_KEY) {
    return null;
  }
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// POST /jobs/upload — upload a JD file, extract text, parse with AI
router.post("/upload", auth, upload.single("jd"), async (req, res) => {
  try {
    const groq = getGroqClient();
    if (!groq) return res.status(500).json({ error: "GROQ_API_KEY is not set" });
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let text = "";
    if (req.file.mimetype === "application/pdf") {
      const parsed = await pdfParse(req.file.buffer);
      text = parsed.text;
    } else {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    }

    const aiRes = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "user",
          content: `Extract structured data from this job description. Return ONLY valid JSON with keys: title, location, type, experienceYears (number), skills (array of strings), description (2-sentence summary).\n\nJD:\n${text.slice(0, 3000)}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const parsed = JSON.parse(aiRes.choices[0].message.content);
    res.json({ extracted: parsed, rawText: text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /jobs — save a job
router.post("/", auth, async (req, res) => {
  try {
    const job = await Job.create({ ...req.body, recruiter: req.recruiter._id });
    res.status(201).json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /jobs — list recruiter's jobs
router.get("/", auth, async (req, res) => {
  try {
    const jobs = await Job.find({ recruiter: req.recruiter._id }).sort({
      createdAt: -1
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /jobs/:id — update status or fields
router.patch("/:id", auth, async (req, res) => {
  try {
    const job = await Job.findOneAndUpdate(
      { _id: req.params.id, recruiter: req.recruiter._id },
      req.body,
      { new: true }
    );
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
