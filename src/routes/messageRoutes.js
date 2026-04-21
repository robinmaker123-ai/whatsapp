const express = require("express");

const {
  deleteMessage,
  forwardMessage,
  getConversation,
  sendMessage,
} = require("../controllers/messageController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/:userId", protect, getConversation);
router.post("/send", protect, sendMessage);
router.post("/:messageId/forward", protect, forwardMessage);
router.patch("/:messageId/delete", protect, deleteMessage);

module.exports = router;
