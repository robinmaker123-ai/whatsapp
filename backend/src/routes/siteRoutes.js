const express = require("express");

const { getSiteOverview } = require("../controllers/siteController");

const router = express.Router();

router.get("/overview", getSiteOverview);

module.exports = router;
