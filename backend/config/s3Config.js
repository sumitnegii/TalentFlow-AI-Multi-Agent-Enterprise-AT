const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
require("dotenv").config();

// Flexible credential loading to prevent typos in Render dashboard
const accessKeyId = (process.env.ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || "").trim();
const secretAccessKey = (process.env.SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || "").trim();
const region = (process.env.AWS_REGION || "ap-south-1").trim();
const bucketName = (process.env.S3_BUCKET_NAME || "hire-buddy-resumes").trim();

// Diagnostic logging (Safely report presence without leaking sensitive keys)
if (!accessKeyId || !secretAccessKey) {
  console.error(`[S3] ❌ CREDENTIALS MISSING: Checked ACCESS_KEY_ID and AWS_ACCESS_KEY_ID. (Found AKID: ${!!accessKeyId}, Found SECRET: ${!!secretAccessKey})`);
} else {
  console.log(`[S3] ✅ Credentials Status: Found (Region: ${region})`);
}

const s3 = new S3Client({
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  region,
});

console.log("[S3] Client initialized for bucket:", bucketName);

module.exports = { s3, getSignedUrl };
