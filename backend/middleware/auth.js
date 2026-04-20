const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Recruiter = require("../models/Recruiter");
const mongoose = require("mongoose");

module.exports = async (req, res, next) => {
  if (String(process.env.DISABLE_AUTH || "").toLowerCase() === "true") {
    const rawId = process.env.BYPASS_RECRUITER_ID || "000000000000000000000001";
    const recruiterId = mongoose.Types.ObjectId.isValid(rawId)
      ? new mongoose.Types.ObjectId(rawId)
      : new mongoose.Types.ObjectId("000000000000000000000001");

    req.user = {
      _id: recruiterId,
      name: "Dev Recruiter",
      email: "dev@local",
      role: "recruiter"
    };

    return next();
  }

  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "No token provided" });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not set");
    return res.status(500).json({ error: "Server configuration error" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Try User first (primary model), fallback to Recruiter
    let user = await User.findById(decoded.id).select("-passwordHash -otp -otpExpiry");
    if (!user) {
      user = await Recruiter.findById(decoded.id).select("-password");
    }
    
    if (!user) {
      return res.status(401).json({ error: "Invalid token" });
    }
    
    // Normalize to req.user (consistent across app)
    req.user = {
      _id: user._id,
      email: user.email,
      name: user.name || "User",
      company: user.company || null,
      role: user.role || "recruiter"
    };
    
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid token" });
  }
};
