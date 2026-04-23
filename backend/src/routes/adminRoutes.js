const express = require("express");

const {
  banUser,
  broadcastAnnouncement,
  getAdminOverview,
  getReleaseManagement,
  listAnnouncements,
  listErrorLogs,
  listReportedUsers,
  listUsers,
  loginAdmin,
  publishRelease,
  unbanUser,
} = require("../controllers/adminController");
const { requireAdmin } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/auth/login", loginAdmin);
router.get("/overview", requireAdmin, getAdminOverview);
router.get("/users", requireAdmin, listUsers);
router.get("/reports", requireAdmin, listReportedUsers);
router.patch("/users/:userId/ban", requireAdmin, banUser);
router.patch("/users/:userId/unban", requireAdmin, unbanUser);
router.get("/announcements", requireAdmin, listAnnouncements);
router.post("/announcements", requireAdmin, broadcastAnnouncement);
router.get("/logs", requireAdmin, listErrorLogs);
router.get("/releases", requireAdmin, getReleaseManagement);
router.post("/releases", requireAdmin, publishRelease);

module.exports = router;
