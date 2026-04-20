const express = require("express");
const jwt = require("jsonwebtoken");
const Recruiter = require("../models/Recruiter");

const router = express.Router();

const sign = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "7d" });

const normalizeEmail = (email) =>
  typeof email === "string" ? email.trim().toLowerCase() : "";

// POST /api/auth/signup
const signupHandler = async (req, res) => {
  try {
    const { name, email, password, company } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!name || !normalizedEmail || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }

    const exists = await Recruiter.findOne({ email: normalizedEmail });
    if (exists) return res.status(409).json({ error: "Email already registered" });
    const recruiter = await Recruiter.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      company: typeof company === "string" ? company.trim() : company
    });
    res.status(201).json({
      token: sign(recruiter._id),
      recruiter: {
        id: recruiter._id,
        name: recruiter.name,
        email: recruiter.email,
        company: recruiter.company
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

router.post("/signup", signupHandler);
router.post("/register", signupHandler);

// POST /auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const recruiter = await Recruiter.findOne({ email: normalizedEmail });
    if (!recruiter) return res.status(401).json({ error: "Invalid credentials" });
    const match = await recruiter.comparePassword(password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    res.json({
      token: sign(recruiter._id),
      recruiter: {
        id: recruiter._id,
        name: recruiter.name,
        email: recruiter.email,
        company: recruiter.company
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
