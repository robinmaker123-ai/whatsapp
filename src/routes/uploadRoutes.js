const express = require("express");

const { uploadMedia } = require("../controllers/uploadController");
const { protect } = require("../middlewares/authMiddleware");
const { upload } = require("../middlewares/uploadMiddleware");

const router = express.Router();

router.post("/upload", protect, upload.single("media"), uploadMedia);

module.exports = router;