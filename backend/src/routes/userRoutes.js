const express = require("express");

const {
  exportBackup,
  getChatList,
  getMatchedContacts,
  getProfile,
  getUsers,
  importBackup,
  reportUser,
  syncMatchedContacts,
  updateBlockedContacts,
  updateChatPreferences,
  updateProfile,
  updateSettings,
} = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getUsers);
router.get("/matched-contacts", protect, getMatchedContacts);
router.post("/matched-contacts", protect, syncMatchedContacts);
router.post("/matched-contacts/sync", protect, syncMatchedContacts);
router.get("/chats", protect, getChatList);
router.get("/profile", protect, getProfile);
router.patch("/profile", protect, updateProfile);
router.patch("/settings", protect, updateSettings);
router.patch("/chats/:userId/preferences", protect, updateChatPreferences);
router.patch("/blocked/:userId", protect, updateBlockedContacts);
router.post("/reports/:userId", protect, reportUser);
router.get("/backup/export", protect, exportBackup);
router.post("/backup/import", protect, importBackup);

module.exports = router;
