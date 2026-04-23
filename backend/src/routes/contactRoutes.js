const express = require("express");

const {
  getMatchedContacts,
  syncMatchedContacts,
} = require("../controllers/userController");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

router.get("/", protect, getMatchedContacts);
router.post("/sync", protect, syncMatchedContacts);

module.exports = router;
