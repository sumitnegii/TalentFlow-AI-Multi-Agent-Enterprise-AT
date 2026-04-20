const express = require("express");
const router = express.Router();
const Candidate = require("../models/Candidate");
const auth = require("../middleware/auth");

router.use(auth);

router.get("/", async (req, res) => {
  try {
    const candidates = await Candidate.find({ recruiterId: req.recruiter._id })
      .sort({ createdAt: -1 });
    res.json(candidates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const candidate = await Candidate.findOne({
      _id: req.params.id,
      recruiterId: req.recruiter._id
    });
    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json(candidate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const update = {};
    if (typeof req.body.stage === "string") {
      update.stage = req.body.stage;
    }

    const candidate = await Candidate.findOneAndUpdate(
      { _id: req.params.id, recruiterId: req.recruiter._id },
      update,
      { new: true }
    );

    if (!candidate) return res.status(404).json({ error: "Candidate not found" });
    res.json(candidate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
