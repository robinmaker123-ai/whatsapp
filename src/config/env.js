const path = require("path");

require("dotenv").config({
  path: path.resolve(process.cwd(), ".env"),
});

const parseCorsOrigin = (value) => {
  if (!value) {
    return "*";
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    return "*";
  }

  return origins.length === 1 ? origins[0] : origins;
};

const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES) || 5,
  corsOrigin: parseCorsOrigin(process.env.CLIENT_URL),
  websiteUrl: process.env.WEBSITE_URL || "",
  apkChannel: process.env.APK_CHANNEL || "production",
  phoneHashSecret: process.env.PHONE_HASH_SECRET || process.env.JWT_SECRET,
  apkFileName: process.env.APK_FILE_NAME || "videoapp-latest.apk",
  apkDownloadUrl: process.env.APK_DOWNLOAD_URL || "",
  apkChecksumSha256: process.env.APK_CHECKSUM_SHA256 || "",
  apkReleaseNotes: process.env.APK_RELEASE_NOTES || "",
  apkVersion: process.env.APK_VERSION || "1.0.0",
  apkBuildNumber: Number(process.env.APK_BUILD_NUMBER) || 1,
  apkMinimumSupportedBuildNumber:
    Number(process.env.APK_MINIMUM_SUPPORTED_BUILD_NUMBER) ||
    Number(process.env.APK_BUILD_NUMBER) ||
    1,
  downloadAdminToken: process.env.DOWNLOAD_ADMIN_TOKEN || "",
  enableDevOtpPreview:
    (process.env.ENABLE_DEV_OTP_PREVIEW || "false").toLowerCase() === "true",
  allowInMemoryMongo:
    (process.env.ALLOW_IN_MEMORY_MONGO || "true").toLowerCase() === "true",
};

const missingVariables = [
  ["MONGO_URI", config.mongoUri],
  ["JWT_SECRET", config.jwtSecret],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVariables.join(", ")}`
  );
}

module.exports = config;
