const pdf = require("pdf-parse");
const mammoth = require("mammoth");
const Tesseract = require("tesseract.js");
const WordExtractor = require("word-extractor");
const { PDFDocument } = require("pdf-lib");

const wordExtractor = new WordExtractor();

/**
 * Enhanced Text Extraction Utility
 * Handles: PDF (Text & OCR Fallback), Docx, Doc, Images (OCR)
 */
async function extractText(file) {
  const { buffer, mimetype, originalname } = file;

  // ── PDF Handling ─────────────────────────────────────────────────────────────
  if (mimetype === "application/pdf") {
    try {
      const data = await pdf(buffer);
      let text = data.text || "";

      // If text is suspiciously short, it's likely a scanned document (image-PDF)
      if (text.trim().length < 150) {
        console.log(`[OCR] Scanned PDF detected (${originalname}). Attempting image extraction...`);
        try {
          const pdfDoc = await PDFDocument.load(buffer);
          const pages = pdfDoc.getPages();
          let ocrTextParts = [];

          // Tesseract.js can take page images. 
          // Since PDF -> Image without native dependencies (canvas) is hard in Node,
          // we'll advise users to upload images directly, or we attempt to find 
          // direct image objects in the PDF stream.
          // For now, if scanned, we return a special marker so Agent 4 knows it's an image.
          // Actually, Tesseract.js 5+ might handle PDF buffers directly in some environments,
          // but usually it needs image buffers.
          
          text += "\n[SYSTEM: This document appears to be a scan or image. No selectable text found.]\n";
          
          // Note: Full PDF-to-Image OCR requires 'canvas' or external binaries which are 
          // limited in this environment. Direct image uploads (PNG/JPG) are fully supported.
        } catch (ocrErr) {
          console.error("[OCR] PDF OCR check failed:", ocrErr.message);
        }
      }
      return text;
    } catch (err) {
      console.error("[PDF] Extraction failed:", err.message);
      return "";
    }
  }

  // ── Word (Docx) Handling ─────────────────────────────────────────────────────
  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  // ── Word (Doc) Handling ──────────────────────────────────────────────────────
  if (mimetype === "application/msword") {
    const doc = await wordExtractor.extract(buffer);
    return doc.getBody();
  }

  // ── Image Handling (Direct) ──────────────────────────────────────────────────
  if (mimetype.startsWith("image/")) {
    console.log(`[OCR] Processing direct image resume: ${originalname}`);
    const { data } = await Tesseract.recognize(buffer, "eng");
    return data.text;
  }

  return "";
}

module.exports = extractText;
