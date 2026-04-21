const AppRelease = require("../models/AppRelease");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");

const DEFAULT_CHANNEL = "production";
const DEFAULT_PLATFORM = "android";

const normalizeChannel = (value = "") =>
  String(value || DEFAULT_CHANNEL).trim().toLowerCase() || DEFAULT_CHANNEL;

const normalizeReleaseNotes = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry || "").trim())
      .filter(Boolean);
  }

  return String(value || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const buildTrackedDownloadUrl = (req, channel) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const normalizedChannel = encodeURIComponent(normalizeChannel(channel));
  return `${baseUrl}/downloads/latest.apk?channel=${normalizedChannel}`;
};

const serializeRelease = (req, releaseDoc) => ({
  id: releaseDoc.id,
  version: releaseDoc.version,
  buildNumber: releaseDoc.buildNumber,
  channel: releaseDoc.channel,
  platform: releaseDoc.platform,
  fileName: releaseDoc.fileName,
  checksumSha256: releaseDoc.checksumSha256,
  minimumSupportedBuildNumber: releaseDoc.minimumSupportedBuildNumber,
  releaseNotes: releaseDoc.releaseNotes || [],
  downloadCount: releaseDoc.downloadCount || 0,
  publishedAt: releaseDoc.publishedAt,
  apkUrl: releaseDoc.apkUrl,
  downloadUrl: buildTrackedDownloadUrl(req, releaseDoc.channel),
  isLatest: Boolean(releaseDoc.isLatest),
  createdAt: releaseDoc.createdAt,
  updatedAt: releaseDoc.updatedAt,
});

const ensureConfiguredRelease = async (channel) => {
  const normalizedChannel = normalizeChannel(channel);

  if (!config.apkDownloadUrl || normalizedChannel !== normalizeChannel(config.apkChannel)) {
    return null;
  }

  try {
    await AppRelease.updateMany(
      {
        platform: DEFAULT_PLATFORM,
        channel: normalizedChannel,
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
        platform: DEFAULT_PLATFORM,
        channel: normalizedChannel,
        version: config.apkVersion,
        buildNumber: config.apkBuildNumber,
      },
      {
        $set: {
          fileName: config.apkFileName,
          apkUrl: config.apkDownloadUrl,
          checksumSha256: config.apkChecksumSha256,
          minimumSupportedBuildNumber: config.apkMinimumSupportedBuildNumber,
          releaseNotes: normalizeReleaseNotes(config.apkReleaseNotes),
          publishedAt: new Date(),
          isLatest: true,
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

    return release;
  } catch (error) {
    return AppRelease.findOne({
      platform: DEFAULT_PLATFORM,
      channel: normalizedChannel,
      version: config.apkVersion,
      buildNumber: config.apkBuildNumber,
    }).sort({ publishedAt: -1, buildNumber: -1 });
  }
};

const findLatestRelease = async (channel) => {
  const normalizedChannel = normalizeChannel(channel);
  let latestRelease = await AppRelease.findOne({
    channel: normalizedChannel,
    platform: DEFAULT_PLATFORM,
    isLatest: true,
  }).sort({ publishedAt: -1, buildNumber: -1 });

  if (latestRelease) {
    return latestRelease;
  }

  latestRelease = await AppRelease.findOne({
    channel: normalizedChannel,
    platform: DEFAULT_PLATFORM,
  }).sort({ publishedAt: -1, buildNumber: -1 });

  if (latestRelease) {
    return latestRelease;
  }

  return ensureConfiguredRelease(normalizedChannel);
};

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
  const releases = await AppRelease.find({
    channel: normalizedChannel,
    platform: DEFAULT_PLATFORM,
  })
    .sort({ isLatest: -1, publishedAt: -1, buildNumber: -1 })
    .limit(limit);

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
    release: serializeRelease(req, release),
  });
});

const downloadLatestRelease = asyncHandler(async (req, res) => {
  const latestRelease = await findLatestRelease(req.query.channel);

  if (!latestRelease || !latestRelease.apkUrl) {
    res.status(404);
    throw new Error("No APK is currently available for download.");
  }

  await AppRelease.updateOne(
    {
      _id: latestRelease._id,
    },
    {
      $inc: {
        downloadCount: 1,
      },
    }
  );

  res.redirect(302, latestRelease.apkUrl);
});

module.exports = {
  createRelease,
  downloadLatestRelease,
  getLatestRelease,
  listReleases,
};
