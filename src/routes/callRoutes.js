const express = require("express");

const { createCall, getCalls, updateCall } = require("../controllers/callController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getCalls);
router.post("/", protect, createCall);
router.post("/start", protect, createCall);
router.patch("/:callId", protect, updateCall);

module.exports = router;
