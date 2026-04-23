const fs = require("fs");
const path = require("path");

const AppRelease = require("../models/AppRelease");
const config = require("../config/env");

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

const readJsonFile = (targetPath) => {
  if (!targetPath || !fs.existsSync(targetPath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(targetPath, "utf8"));
  } catch (error) {
    return null;
  }
};

const buildTrackedDownloadUrl = (req, channel) => {
  const baseUrl = `${req.protocol}://${req.get("host")}`;
  const normalizedChannel = encodeURIComponent(normalizeChannel(channel));
  return `${baseUrl}/downloads/latest.apk?channel=${normalizedChannel}`;
};

const buildWebsiteRelativeDownloadPath = (fileName) =>
  fileName ? `/downloads/${fileName}` : "";

const formatAppSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const decimals = unitIndex >= 2 ? 1 : 0;
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
};

const toComparableTimestamp = (value) => {
  if (!value) {
    return 0;
  }

  try {
    return new Date(value).getTime() || 0;
  } catch (error) {
    return 0;
  }
};

const toReleaseShape = (payload = {}) => ({
  id: payload.id || payload._id?.toString() || `bundled-${payload.buildNumber || 0}`,
  version: String(payload.version || "").trim() || "0.0.0",
  buildNumber: Number(payload.buildNumber) || 0,
  channel: normalizeChannel(payload.channel),
  platform: String(payload.platform || DEFAULT_PLATFORM).trim() || DEFAULT_PLATFORM,
  fileName: String(payload.fileName || config.apkFileName || "").trim(),
  checksumSha256: String(payload.checksumSha256 || "").trim().toLowerCase(),
  fileSizeBytes:
    Number.isFinite(Number(payload.fileSizeBytes)) && Number(payload.fileSizeBytes) >= 0
      ? Number(payload.fileSizeBytes)
      : null,
  minimumSupportedBuildNumber: Math.max(
    1,
    Number(payload.minimumSupportedBuildNumber) || Number(payload.buildNumber) || 1
  ),
  releaseNotes: normalizeReleaseNotes(payload.releaseNotes),
  downloadCount: Number(payload.downloadCount) || 0,
  publishedAt: payload.publishedAt || payload.createdAt || null,
  apkUrl: String(payload.apkUrl || "").trim(),
  isLatest: Boolean(payload.isLatest),
  createdAt: payload.createdAt || null,
  updatedAt: payload.updatedAt || null,
  bundledFilePath: payload.bundledFilePath || "",
  source: payload.source || "database",
});

const loadBundledRelease = (channel = DEFAULT_CHANNEL) => {
  const manifest = readJsonFile(config.sharedReleaseManifestPath);

  if (!manifest) {
    return null;
  }

  const normalizedChannel = normalizeChannel(channel);
  const manifestChannel = normalizeChannel(manifest.channel);

  if (manifestChannel !== normalizedChannel) {
    return null;
  }

  const fileName = String(manifest.fileName || config.apkFileName || "").trim();
  const bundledFilePath = fileName ? path.join(config.sharedReleaseDir, fileName) : "";
  const hasBundledFile = Boolean(bundledFilePath && fs.existsSync(bundledFilePath));
  const fileStats = hasBundledFile ? fs.statSync(bundledFilePath) : null;

  return toReleaseShape({
    ...manifest,
    fileName,
    fileSizeBytes:
      manifest.fileSizeBytes != null ? manifest.fileSizeBytes : fileStats?.size ?? null,
    bundledFilePath: hasBundledFile ? bundledFilePath : "",
    source: "bundled",
    isLatest: true,
  });
};

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
          fileSizeBytes: null,
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

    return toReleaseShape(release.toJSON());
  } catch (error) {
    const release = await AppRelease.findOne({
      platform: DEFAULT_PLATFORM,
      channel: normalizedChannel,
      version: config.apkVersion,
      buildNumber: config.apkBuildNumber,
    }).sort({ publishedAt: -1, buildNumber: -1 });

    return release ? toReleaseShape(release.toJSON()) : null;
  }
};

const findLatestDatabaseRelease = async (channel) => {
  const normalizedChannel = normalizeChannel(channel);
  let latestRelease = await AppRelease.findOne({
    channel: normalizedChannel,
    platform: DEFAULT_PLATFORM,
    isLatest: true,
  }).sort({ publishedAt: -1, buildNumber: -1 });

  if (!latestRelease) {
    latestRelease = await AppRelease.findOne({
      channel: normalizedChannel,
      platform: DEFAULT_PLATFORM,
    }).sort({ publishedAt: -1, buildNumber: -1 });
  }

  if (!latestRelease) {
    return ensureConfiguredRelease(normalizedChannel);
  }

  return toReleaseShape(latestRelease.toJSON());
};

const selectLatestRelease = (releases = []) =>
  releases
    .filter(Boolean)
    .sort((firstRelease, secondRelease) => {
      const buildDelta = (secondRelease.buildNumber || 0) - (firstRelease.buildNumber || 0);

      if (buildDelta !== 0) {
        return buildDelta;
      }

      return (
        toComparableTimestamp(secondRelease.publishedAt) -
        toComparableTimestamp(firstRelease.publishedAt)
      );
    })[0] || null;

const findLatestRelease = async (channel) => {
  const normalizedChannel = normalizeChannel(channel);
  const [databaseRelease, bundledRelease] = await Promise.all([
    findLatestDatabaseRelease(normalizedChannel),
    Promise.resolve(loadBundledRelease(normalizedChannel)),
  ]);

  return selectLatestRelease([databaseRelease, bundledRelease]);
};

const listReleases = async (channel, limit = 10) => {
  const normalizedChannel = normalizeChannel(channel);
  const releases = await AppRelease.find({
    channel: normalizedChannel,
    platform: DEFAULT_PLATFORM,
  })
    .sort({ isLatest: -1, publishedAt: -1, buildNumber: -1 })
    .limit(limit);

  const serialized = releases.map((releaseDoc) => toReleaseShape(releaseDoc.toJSON()));
  const bundledRelease = loadBundledRelease(normalizedChannel);

  if (bundledRelease) {
    const alreadyIncluded = serialized.some(
      (release) =>
        release.version === bundledRelease.version &&
        release.buildNumber === bundledRelease.buildNumber &&
        release.channel === bundledRelease.channel
    );

    if (!alreadyIncluded) {
      serialized.unshift(bundledRelease);
    }
  }

  return serialized.slice(0, limit);
};

const serializeRelease = (req, releasePayload) => {
  const release = toReleaseShape(releasePayload);
  const hasDownloadSource = Boolean(release.bundledFilePath || release.apkUrl);
  const relativeWebsiteDownloadPath = release.bundledFilePath
    ? buildWebsiteRelativeDownloadPath(release.fileName)
    : "";

  return {
    id: release.id,
    version: release.version,
    buildNumber: release.buildNumber,
    channel: release.channel,
    platform: release.platform,
    fileName: release.fileName,
    checksumSha256: release.checksumSha256,
    fileSizeBytes: release.fileSizeBytes,
    appSizeLabel: formatAppSize(release.fileSizeBytes),
    minimumSupportedBuildNumber: release.minimumSupportedBuildNumber,
    releaseNotes: release.releaseNotes || [],
    downloadCount: release.downloadCount || 0,
    publishedAt: release.publishedAt,
    apkUrl: release.apkUrl,
    downloadUrl: hasDownloadSource ? buildTrackedDownloadUrl(req, release.channel) : "",
    relativeWebsiteDownloadPath,
    isLatest: Boolean(release.isLatest),
    source: release.source,
    createdAt: release.createdAt,
    updatedAt: release.updatedAt,
  };
};

module.exports = {
  DEFAULT_CHANNEL,
  DEFAULT_PLATFORM,
  buildTrackedDownloadUrl,
  findLatestRelease,
  formatAppSize,
  listReleases,
  loadBundledRelease,
  normalizeChannel,
  normalizeReleaseNotes,
  serializeRelease,
};
