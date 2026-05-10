/**
 * config/gemini.js
 * Gemini AI client — gracefully unavailable when API key is absent.
 */

const logger = require("../utils/logger");

let genAI = null;

try {
  if (process.env.GEMINI_API_KEY) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
} catch (err) {
  logger.warn("Gemini AI module unavailable", { error: err.message });
}

async function detectCategoryFromImage(imageBase64) {
  if (!genAI) {
    logger.warn("detectCategoryFromImage called but Gemini is not configured");
    return "unknown";
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Identify the object in this image.
Reply ONLY with one word:
bag, bottle, phone, laptop, wallet, keys
Do NOT explain.`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
    ]);

    const text = result.response.text().toLowerCase().trim();
    logger.debug("Gemini category detection", { category: text });
    return text;

  } catch (err) {
    logger.error("Gemini category detection failed", { error: err.message });
    return "unknown";
  }
}

module.exports = { detectCategoryFromImage };
