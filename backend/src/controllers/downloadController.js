const AppRelease = require("../models/AppRelease");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");
const {
  DEFAULT_PLATFORM,
  findLatestRelease,
  listReleases: listReleaseSources,
  normalizeChannel,
  normalizeReleaseNotes,
  serializeRelease,
} = require("../services/releaseService");

const requireAdminToken = (req, res) => {
  const authHeader = String(req.headers.authorization || "").trim();
  const headerToken = String(req.headers["x-admin-token"] || "").trim();
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const token = headerToken || bearerToken;

  if (!config.downloadAdminToken || token !== config.downloadAdminToken) {
    res.status(401);
    throw new Error("A valid release admin token is required.");
  }
};

const listReleases = asyncHandler(async (req, res) => {
  const normalizedChannel = normalizeChannel(req.query.channel);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));
  const releases = await listReleaseSources(normalizedChannel, limit);

  res.status(200).json({
    releases: releases.map((releaseDoc) => serializeRelease(req, releaseDoc)),
  });
});

const getLatestRelease = asyncHandler(async (req, res) => {
  const latestRelease = await findLatestRelease(req.query.channel);

  if (!latestRelease) {
    res.status(404);
    throw new Error("No Android release is published yet.");
  }

  res.status(200).json({
    release: serializeRelease(req, latestRelease),
  });
});

const createRelease = asyncHandler(async (req, res) => {
  requireAdminToken(req, res);

  const version = String(req.body.version || "").trim();
  const buildNumber = Number(req.body.buildNumber);
  const channel = normalizeChannel(req.body.channel);
  const apkUrl = String(req.body.apkUrl || "").trim();
  const fileName = String(req.body.fileName || "").trim();
  const checksumSha256 = String(req.body.checksumSha256 || "").trim().toLowerCase();
  const fileSizeBytes =
    Number.isFinite(Number(req.body.fileSizeBytes)) && Number(req.body.fileSizeBytes) >= 0
      ? Number(req.body.fileSizeBytes)
      : null;
  const minimumSupportedBuildNumber = Math.max(
    1,
    Number(req.body.minimumSupportedBuildNumber) || buildNumber || 1
  );
  const releaseNotes = normalizeReleaseNotes(req.body.releaseNotes);

  if (!version) {
    res.status(400);
    throw new Error("A release version is required.");
  }

  if (!Number.isFinite(buildNumber) || buildNumber < 1) {
    res.status(400);
    throw new Error("A valid buildNumber is required.");
  }

  if (!apkUrl) {
    res.status(400);
    throw new Error("An apkUrl is required.");
  }

  try {
    new URL(apkUrl);
  } catch (error) {
    res.status(400);
    throw new Error("apkUrl must be a valid absolute URL.");
  }

  await AppRelease.updateMany(
    {
      channel,
      platform: DEFAULT_PLATFORM,
      isLatest: true,
    },
    {
      $set: {
        isLatest: false,
      },
    }
  );

  const release = await AppRelease.findOneAndUpdate(
    {
      channel,
      platform: DEFAULT_PLATFORM,
      version,
      buildNumber,
    },
    {
      $set: {
        fileName,
        apkUrl,
        checksumSha256,
        fileSizeBytes,
        minimumSupportedBuildNumber,
        releaseNotes,
        isLatest: true,
        publishedAt: new Date(),
      },
      $setOnInsert: {
        downloadCount: 0,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(201).json({
    message: "Release published successfully.",
    release: serializeRelease(req, release.toJSON()),
  });
});

const downloadLatestRelease = asyncHandler(async (req, res) => {
  const latestRelease = await findLatestRelease(req.query.channel);

  if (!latestRelease) {
    res.status(404);
    throw new Error("No APK is currently available for download.");
  }

  if (latestRelease.source !== "bundled" && latestRelease.id && !latestRelease.id.startsWith("bundled-")) {
    await AppRelease.updateOne(
      {
        _id: latestRelease.id,
      },
      {
        $inc: {
          downloadCount: 1,
        },
      }
    );
  }

  if (latestRelease.bundledFilePath) {
    res.type("application/vnd.android.package-archive");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.download(latestRelease.bundledFilePath, latestRelease.fileName || config.apkFileName);
    return;
  }

  if (latestRelease.apkUrl) {
    res.redirect(302, latestRelease.apkUrl);
    return;
  }

  res.status(404);
  throw new Error("No APK is currently available for download.");
});

module.exports = {
  createRelease,
  downloadLatestRelease,
  getLatestRelease,
  listReleases,
};
