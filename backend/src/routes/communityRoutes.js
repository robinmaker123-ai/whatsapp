const express = require("express");

const { createCommunity, getCommunities } = require("../controllers/communityController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getCommunities);
router.post("/", protect, createCommunity);

module.exports = router;
