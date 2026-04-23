const express = require("express");

const { createGroup, getGroups } = require("../controllers/groupController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getGroups);
router.post("/", protect, createGroup);

module.exports = router;
