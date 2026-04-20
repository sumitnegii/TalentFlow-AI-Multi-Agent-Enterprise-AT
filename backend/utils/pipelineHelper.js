/**
 * backend/utils/pipelineHelper.js
 * 
 * Reusable logic for running the 9-agent recruitment assessment pipeline.
 */

const JobCampaign = require("../models/JobCampaign");
const JobCandidate = require("../models/JobCandidate");
const GlobalCandidate = require("../models/GlobalCandidate");
const JobApplication = require("../models/JobApplication");

// Agents
const cvValidator = require("../lib/agents/cvValidator");
const extractIdentity = require("../lib/agents/identityExtractor");
const matchEngine = require("../lib/agents/matchEngine");
const debateReconcile = require("../lib/agents/debateReconciler");
const hrReview = require("../lib/agents/hrReviewer");
const generateRecommendation = require("../lib/agents/recommendationAgent");

/**
 * Runs the full evaluation pipeline for all pending candidates in a job campaign.
 * This is designed to be called asynchronously (non-blocking).
 * 
 * @param {string} jobId - The MongoDB ID of the JobCampaign
 */
async function runAutomatedPipeline(jobId) {
  try {
    const campaign = await JobCampaign.findById(jobId);
    if (!campaign || !campaign.jd_analysis) {
      console.warn(`[Pipeline] Skipping automated run for Job ${jobId}: Campaign or JD Analysis missing.`);
      return;
    }

    // Find applications that need any step of evaluation
    const pending = await JobApplication.find({
      jobId: campaign._id,
      status: { $in: ["UPLOADED", "AGENT_3_4_DONE", "AGENT_5_DONE", "AGENT_6_7_DONE"] },
    }).populate("candidateId");

    if (pending.length === 0) return;

    console.log(`[Pipeline] Starting automated evaluation for ${pending.length} candidate(s) in "${campaign.title}"...`);

    // Update campaign status
    if (campaign.status !== "Evaluating") {
      campaign.status = "Evaluating";
      await campaign.save();
    }

    // Sequential processing to respect rate limits and ensure consistency
    for (const app of pending) {
      try {
        const candidate = app.candidateId;
        console.log(`[Pipeline] Processing ${candidate.name} (Application ID: ${app._id})...`);

        // Step 1: Agent 5 (Match Engine)
        if (app.status === "AGENT_3_4_DONE") {
          const match_results = await matchEngine(candidate.validated_skills, campaign.jd_analysis);
          app.match_score = match_results.match_score;
          app.match_results = match_results;
          app.status = "AGENT_5_DONE";
          await app.save();
        }

        // Step 2: Agent 6+7 (Debate + Reconcile)
        if (app.status === "AGENT_5_DONE") {
          const debate = await debateReconcile(
            app.match_results,
            candidate.validated_skills,
            campaign.jd_analysis
          );
          
          app.counter_analysis = {
            technical_verdict: debate.technical_verdict,
            strategic_potential: debate.strategic_potential,
            fairness_audit: debate.fairness_audit
          };
          app.debate_summary = debate.board_monologue;
          app.final_score = debate.final_agreed_score;
          app.corrected_score = debate.final_agreed_score;
          app.final_decision = debate.final_decision;
          
          app.status = "AGENT_6_7_DONE";
          await app.save();
        }
      } catch (candErr) {
        console.error(`[Pipeline] Failed on application ${app._id}:`, candErr.message);
      }
    }

    // 4. Ranking (Role-specific)
    const evaluated = await JobApplication.find({
      jobId: campaign._id,
      status: "AGENT_6_7_DONE",
    }).populate("candidateId");

    if (evaluated.length > 0) {
      const sorted = evaluated.sort((a, b) => (b.final_score || 0) - (a.final_score || 0));

      for (let i = 0; i < sorted.length; i++) {
        const app = sorted[i];
        try {
          if (i < 5) {
            const hrNote = await hrReview({ ...app.candidateId.toObject(), ...app.toObject() }, campaign.jd_analysis);
            app.hr_note = hrNote.summary_note;
          } else {
            app.hr_note = "Auto-reviewed (High volume).";
          }
          app.rank = i + 1;
          app.status = "COMPLETED";
          await app.save();
        } catch (hrErr) {
          console.error(`[Pipeline] Agent 9 failed for application ${app._id}:`, hrErr.message);
        }
      }
      campaign.status = "Completed";
    }

    // 5. Final Recommendations
    const finalApps = await JobApplication.find({
      jobId: campaign._id,
      status: "COMPLETED",
    }).populate("candidateId").sort({ final_score: -1 }).limit(5);

    if (finalApps.length >= 2) {
      try {
        const rec = await generateRecommendation({
          candidates: finalApps.map(app => ({ ...app.candidateId.toObject(), ...app.toObject() })),
          jobTitle: campaign.title,
          jdRequirements: campaign.jd_analysis?.must_have_skills || campaign.jd_analysis?.required_skills || []
        });
        campaign.ai_recommendation = rec;
      } catch (recErr) { console.error(`[Pipeline] Recommendation failed:`, recErr.message); }
    }

    await campaign.save();
    console.log(`[Pipeline] Automated run complete for Job ${jobId}.`);
  } catch (err) {
    console.error(`[Pipeline] Global failure for Job ${jobId}:`, err.message);
  }
}

module.exports = {
  runAutomatedPipeline
};
