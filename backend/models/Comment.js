const mongoose = require("mongoose");

const CommentSchema = new mongoose.Schema({
  candidateId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "JobCandidate",
    required: true,
    index: true,
  },
  author: { type: String, default: "Admin" },
  body: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Comment", CommentSchema);
