const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// 🔥 SIMPLE CATEGORY DETECTION (NO EMBEDDING)
async function detectCategoryFromImage(imageBase64) {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash"   // ✅ YOUR WORKING MODEL
    });

    const prompt = `
Identify the object in this image.
Reply ONLY with one word:
bag, bottle, phone, laptop, wallet, keys
Do NOT explain.
`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: imageBase64
        }
      }
    ]);

    const text = result.response.text().toLowerCase().trim();

    console.log("🧠 Category:", text);

    return text;

  } catch (err) {
    console.error("❌ Gemini failed:", err.message);
    return "unknown";
  }
}

module.exports = { detectCategoryFromImage };