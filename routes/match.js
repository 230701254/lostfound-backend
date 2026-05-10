/**
 * routes/match.js
 * Category-based item matching. Debug console.logs replaced with logger.
 * validateMatch middleware added.
 */

const express = require("express");
const router = express.Router();
const { getContainer } = require("../config/azure");
const { validateMatch } = require("../middleware/validate");
const logger = require("../utils/logger");

router.post("/", validateMatch, async (req, res) => {
  try {
    const { category, type } = req.body; // already sanitized by validateMatch

    const targetType = type === "lost" ? "found" : "lost";
    const container = getContainer(targetType);

    const { resources = [] } = await container.items
      .query("SELECT * FROM c")
      .fetchAll();

    logger.debug("Match search", { category, type, targetType, totalFetched: resources.length });

    const matches = resources.filter((item) => {
      if (!item.category) return false;
      const ic = item.category.toLowerCase().trim();
      return ic === category || ic.includes(category) || category.includes(ic);
    });

    matches.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const topMatches = matches.slice(0, 5).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      location: item.location,
      imageUrl: item.imageUrl,
      type: item.type,
      user: item.user,
      createdAt: item.createdAt,
    }));

    logger.info("Match completed", { category, type, matchCount: topMatches.length });

    return res.json({ success: true, matches: topMatches });

  } catch (err) {
    logger.error("Match route error", { error: err.message });
    return res.status(500).json({ success: false, matches: [], message: "Matching failed" });
  }
});

module.exports = router;
