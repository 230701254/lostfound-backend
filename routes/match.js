const express = require("express");
const router = express.Router();
const { getContainer } = require("../config/azure");

/**
 * POST /match
 * Debug-friendly category-based matching
 */
router.post("/", async (req, res) => {
  try {
    let { category, type } = req.body || {};

    console.log("📥 RAW REQUEST BODY:", req.body);

    // ===============================
    // 🔥 VALIDATION
    // ===============================
    if (!category || !type) {
      console.log("❌ Missing category/type");
      return res.status(400).json({
        success: false,
        matches: [],
        message: "Missing category or type"
      });
    }

    // Normalize input
    category = category.toLowerCase().trim();
    type = type.toLowerCase().trim();

    console.log("📸 Match request:", { category, type });

    // ===============================
    // 1️⃣ DETERMINE TARGET COLLECTION
    // ===============================
    const targetType = type === "lost" ? "found" : "lost";
    console.log("🔄 Searching in collection:", targetType);

    const container = getContainer(targetType);

    // ===============================
    // 2️⃣ FETCH DATA FROM DB
    // ===============================
    const { resources = [] } = await container.items
      .query("SELECT * FROM c")
      .fetchAll();

    console.log("📦 Total items fetched:", resources.length);

    // Print sample data
    console.log("🧾 Sample items:");
    resources.slice(0, 5).forEach((item, i) => {
      console.log(`   [${i}]`, {
        id: item.id,
        category: item.category,
        type: item.type
      });
    });

    // ===============================
    // 3️⃣ FILTER BY CATEGORY (SMART MATCH)
    // ===============================
    const matches = resources.filter(item => {
      if (!item.category) {
        console.log("⚠️ Skipping item (no category):", item.id);
        return false;
      }

      const itemCategory = item.category.toLowerCase().trim();

      const isMatch =
        itemCategory === category ||          // exact match
        itemCategory.includes(category) ||   // partial match
        category.includes(itemCategory);     // reverse match

      if (isMatch) {
        console.log("✅ MATCH FOUND:", {
          id: item.id,
          itemCategory,
          searchCategory: category
        });
      }

      return isMatch;
    });

    console.log("🔍 Total matches found:", matches.length);

    // ===============================
    // 4️⃣ SORT (NEWEST FIRST)
    // ===============================
    matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // ===============================
    // 5️⃣ LIMIT + CLEAN RESPONSE
    // ===============================
    const topMatches = matches.slice(0, 5).map(item => ({
      id: item.id,
      name: item.name,
      description: item.description,
      location: item.location,
      imageUrl: item.imageUrl,
      type: item.type,
      user: item.user,
      createdAt: item.createdAt
    }));

    console.log("📤 Returning matches:", topMatches.length);

    // ===============================
    // 6️⃣ FINAL RESPONSE
    // ===============================
    return res.json({
      success: true,
      matches: topMatches
    });

  } catch (err) {
    console.error("❌ Match error FULL:", err);

    return res.status(500).json({
      success: false,
      matches: [],
      message: "Matching failed"
    });
  }
});

module.exports = router;