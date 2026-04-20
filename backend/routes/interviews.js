const express = require("express");
const Interview = require("../models/Interview");
const Candidate = require("../models/Candidate");
const auth = require("../middleware/auth");

const router = express.Router();

// POST /interviews — schedule an interview
router.post("/", auth, async (req, res) => {
  try {
    const interview = await Interview.create({
      ...req.body,
      recruiter: req.recruiter._id
    });

    await Candidate.findOneAndUpdate(
      { _id: req.body.candidate, recruiterId: req.recruiter._id },
      { stage: "interview" }
    );

    const populated = await interview.populate(["candidate", "job"]);
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /interviews — list recruiter's interviews, optionally filter by date
router.get("/", auth, async (req, res) => {
  try {
    const { date } = req.query;
    const query = { recruiter: req.recruiter._id };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.scheduledAt = { $gte: start, $lte: end };
    }

    const interviews = await Interview.find(query)
      .populate("candidate", "name email")
      .populate("job", "title")
      .sort({ scheduledAt: 1 });
    res.json(interviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /interviews/:id — update status or notes
router.patch("/:id", auth, async (req, res) => {
  try {
    const interview = await Interview.findOneAndUpdate(
      { _id: req.params.id, recruiter: req.recruiter._id },
      req.body,
      { new: true }
    ).populate(["candidate", "job"]);
    res.json(interview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /interviews/:id
router.delete("/:id", auth, async (req, res) => {
  try {
    await Interview.findOneAndDelete({
      _id: req.params.id,
      recruiter: req.recruiter._id
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

