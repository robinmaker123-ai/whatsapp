const express = require("express");

const {
  createRelease,
  downloadLatestRelease,
  getLatestRelease,
  listReleases,
} = require("../controllers/downloadController");

const router = express.Router();

router.get("/latest", getLatestRelease);
router.get("/latest.apk", downloadLatestRelease);
router.get("/releases", listReleases);
router.post("/releases", createRelease);

module.exports = router;
