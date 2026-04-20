const express = require("express");
const Candidate = require("../models/Candidate");
const Job = require("../models/Job");
const Interview = require("../models/Interview");
const auth = require("../middleware/auth");

const router = express.Router();

// GET /analytics/overview — main dashboard stats
router.get("/overview", auth, async (req, res) => {
  try {
    const recruiterId = req.recruiter._id;

    const start = new Date(new Date().setHours(0, 0, 0, 0));
    const end = new Date(new Date().setHours(23, 59, 59, 999));

    const [
      totalCandidates,
      shortlisted,
      rejected,
      pending,
      openRoles,
      todayInterviews
    ] = await Promise.all([
      Candidate.countDocuments({ recruiterId }),
      Candidate.countDocuments({ recruiterId, recommendation: "shortlist" }),
      Candidate.countDocuments({ recruiterId, recommendation: "reject" }),
      Candidate.countDocuments({ recruiterId, recommendation: "review" }),
      Job.countDocuments({ recruiter: recruiterId, status: "active" }),
      Interview.countDocuments({
        recruiter: recruiterId,
        scheduledAt: { $gte: start, $lte: end }
      })
    ]);

    const stageCounts = await Candidate.aggregate([
      { $match: { recruiterId } },
      { $group: { _id: "$stage", count: { $sum: 1 } } }
    ]);

    const recentScans = await Candidate.find({
      recruiterId,
      matchScore: { $exists: true }
    })
      .sort({ updatedAt: -1 })
      .limit(10)
      .select("name matchScore recommendation stage scoredForJob")
      .populate("scoredForJob", "title");

    res.json({
      stats: {
        totalCandidates,
        shortlisted,
        rejected,
        pending,
        openRoles,
        todayInterviews
      },
      funnel: stageCounts,
      recentScans
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

