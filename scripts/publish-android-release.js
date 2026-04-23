const fs = require("fs");
const path = require("path");

const config = require("../backend/src/config/env");

const args = process.argv.slice(2);

const getArgValue = (flagName, fallback = "") => {
  const index = args.indexOf(flagName);

  if (index === -1 || index === args.length - 1) {
    return fallback;
  }

  return args[index + 1];
};

const version = getArgValue("--version");
const buildNumber = Number(getArgValue("--build", "0"));
const minimumSupportedBuildNumber = Number(
  getArgValue("--min-supported", String(buildNumber || 1))
);
const apkUrl = getArgValue("--apk-url");
const fileName = getArgValue("--file-name", config.apkFileName);
const checksumSha256 = getArgValue("--checksum");
const channel = getArgValue("--channel", "production");
const notes = getArgValue("--notes")
  .split("|")
  .map((entry) => entry.trim())
  .filter(Boolean);

if (!version || !Number.isFinite(buildNumber) || buildNumber < 1) {
  console.error("Usage: node scripts/publish-android-release.js --version 1.0.0 --build 10 --apk-url https://...");
  process.exit(1);
}

const releasePayload = {
  version,
  buildNumber,
  minimumSupportedBuildNumber,
  channel,
  platform: "android",
  fileName,
  apkUrl,
  checksumSha256,
  releaseNotes: notes,
  publishedAt: new Date().toISOString(),
  fileSizeBytes: null,
};

fs.mkdirSync(path.dirname(config.sharedReleaseManifestPath), { recursive: true });
fs.writeFileSync(
  config.sharedReleaseManifestPath,
  `${JSON.stringify(releasePayload, null, 2)}\n`,
  "utf8"
);

console.log(`Updated ${config.sharedReleaseManifestPath}`);
