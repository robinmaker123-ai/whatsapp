const express = require("express");

const {
  createStatus,
  deleteStatus,
  getStatusFeed,
  markStatusViewed,
} = require("../controllers/statusController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getStatusFeed);
router.post("/", protect, createStatus);
router.post("/upload", protect, createStatus);
router.post("/:statusId/view", protect, markStatusViewed);
router.delete("/:statusId", protect, deleteStatus);

module.exports = router;
