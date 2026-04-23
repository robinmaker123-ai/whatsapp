const express = require("express");

const {
  getSessions,
  refreshSession,
  revokeCurrentSession,
  revokeSessionById,
  revokeSessionByRefreshToken,
  sendOtp,
  verifyOtp,
} = require("../controllers/authController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/refresh", refreshSession);
router.get("/sessions", protect, getSessions);
router.post("/logout", protect, revokeCurrentSession);
router.post("/logout/refresh", revokeSessionByRefreshToken);
router.delete("/sessions/:sessionId", protect, revokeSessionById);

module.exports = router;
