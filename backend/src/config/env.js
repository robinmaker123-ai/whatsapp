const path = require("path");
const fs = require("fs");

const dotenv = require("dotenv");

const rootDir = path.resolve(__dirname, "../../..");
const sharedDir = path.join(rootDir, "shared");
const sharedConfigDir = path.join(sharedDir, "config");
const sharedReleaseDir = path.join(sharedDir, "releases", "android");
const websitePublicDir = path.join(rootDir, "website", "public");

const initialNodeEnv = process.env.NODE_ENV || "development";
const envFiles = [
  ".env",
  `.env.${initialNodeEnv}`,
  ".env.local",
  `.env.${initialNodeEnv}.local`,
];

envFiles.forEach((fileName) => {
  const targetPath = path.join(rootDir, fileName);

  if (fs.existsSync(targetPath)) {
    dotenv.config({
      path: targetPath,
      override: true,
    });
  }
});

const parseOriginList = (value) => {
  if (!value) {
    return [];
  }

  const origins = value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return origins;
};

const uniqueValues = (values = []) => Array.from(new Set(values.filter(Boolean)));

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  return String(value).trim().toLowerCase() === "true";
};

const parseInteger = (value, fallback) => {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return fallback;
  }

  return parsedValue;
};

const normalizeDurationString = (value, fallback) =>
  String(value || fallback).trim() || fallback;

const logDir = path.join(rootDir, "logs");

const config = {
  rootDir,
  sharedDir,
  sharedConfigDir,
  sharedReleaseDir,
  websitePublicDir,
  nodeEnv: process.env.NODE_ENV || initialNodeEnv,
  isProduction: (process.env.NODE_ENV || initialNodeEnv) === "production",
  appHost: String(process.env.HOST || process.env.APP_HOST || "0.0.0.0").trim() || "0.0.0.0",
  port: parseInteger(process.env.PORT, 5001),
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  refreshTokenSecret: process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET,
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET,
  jwtExpiresIn: normalizeDurationString(process.env.JWT_EXPIRES_IN, "15m"),
  refreshTokenExpiresIn: normalizeDurationString(
    process.env.REFRESH_TOKEN_EXPIRES_IN,
    "30d"
  ),
  adminJwtExpiresIn: normalizeDurationString(
    process.env.ADMIN_JWT_EXPIRES_IN,
    "12h"
  ),
  otpTtlMinutes: parseInteger(process.env.OTP_TTL_MINUTES, 5),
  otpMaxVerifyAttempts: parseInteger(process.env.OTP_MAX_VERIFY_ATTEMPTS, 5),
  otpRequestCooldownSeconds: parseInteger(
    process.env.OTP_REQUEST_COOLDOWN_SECONDS,
    45
  ),
  websiteUrl: process.env.WEBSITE_URL || "",
  websiteDomain: process.env.WEBSITE_DOMAIN || "",
  apiDomain: process.env.API_DOMAIN || "",
  apiUrl: process.env.API_URL || "",
  apkChannel: process.env.APK_CHANNEL || "production",
  phoneHashSecret: process.env.PHONE_HASH_SECRET || process.env.JWT_SECRET,
  apkFileName: process.env.APK_FILE_NAME || "videoapp-latest.apk",
  apkDownloadUrl: process.env.APK_DOWNLOAD_URL || "",
  apkChecksumSha256: process.env.APK_CHECKSUM_SHA256 || "",
  apkReleaseNotes: process.env.APK_RELEASE_NOTES || "",
  apkVersion: process.env.APK_VERSION || "1.0.0",
  apkBuildNumber: parseInteger(process.env.APK_BUILD_NUMBER, 1),
  apkMinimumSupportedBuildNumber:
    parseInteger(process.env.APK_MINIMUM_SUPPORTED_BUILD_NUMBER, 0) ||
    parseInteger(process.env.APK_BUILD_NUMBER, 1) ||
    1,
  downloadAdminToken: process.env.DOWNLOAD_ADMIN_TOKEN || "",
  enableDevOtpPreview: parseBoolean(process.env.ENABLE_DEV_OTP_PREVIEW, false),
  defaultRateLimitWindowMs: parseInteger(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
  defaultRateLimitMax: parseInteger(process.env.RATE_LIMIT_MAX, 120),
  authRateLimitWindowMs: parseInteger(
    process.env.AUTH_RATE_LIMIT_WINDOW_MS,
    10 * 60 * 1000
  ),
  authRateLimitMax: parseInteger(process.env.AUTH_RATE_LIMIT_MAX, 12),
  uploadRateLimitWindowMs: parseInteger(
    process.env.UPLOAD_RATE_LIMIT_WINDOW_MS,
    10 * 60 * 1000
  ),
  uploadRateLimitMax: parseInteger(process.env.UPLOAD_RATE_LIMIT_MAX, 30),
  adminRateLimitWindowMs: parseInteger(
    process.env.ADMIN_RATE_LIMIT_WINDOW_MS,
    10 * 60 * 1000
  ),
  adminRateLimitMax: parseInteger(process.env.ADMIN_RATE_LIMIT_MAX, 40),
  uploadMaxFileSizeBytes: parseInteger(
    process.env.UPLOAD_MAX_FILE_SIZE_BYTES,
    50 * 1024 * 1024
  ),
  adminEmail: String(process.env.ADMIN_EMAIL || "admin@videoapp.example").trim(),
  adminName: String(process.env.ADMIN_NAME || "VideoApp Admin").trim(),
  adminPasswordHash: String(process.env.ADMIN_PASSWORD_HASH || "").trim(),
  trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
  logDir,
  logLevel: String(process.env.LOG_LEVEL || "info").trim().toLowerCase(),
};

config.corsOrigins = uniqueValues([
  ...parseOriginList(process.env.CORS_ORIGINS),
  String(config.websiteUrl || "").trim(),
]);
config.corsOrigin = config.corsOrigins;

config.sharedProductConfigPath = path.join(config.sharedConfigDir, "product.json");
config.sharedReleaseManifestPath = path.join(config.sharedReleaseDir, "release.json");
config.websiteReleaseDir = path.join(config.websitePublicDir, "downloads");
config.websiteProductDataDir = path.join(config.websitePublicDir, "data");
config.websiteDistDir = path.join(rootDir, "website", "dist");
config.bundledApkFilePath = path.join(config.sharedReleaseDir, config.apkFileName);
config.websiteBundledApkPath = `/downloads/${config.apkFileName}`;

const missingVariables = [
  ["MONGO_URI", config.mongoUri],
  ["JWT_SECRET", config.jwtSecret],
  ["REFRESH_TOKEN_SECRET", config.refreshTokenSecret],
  ["ADMIN_JWT_SECRET", config.adminJwtSecret],
]
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingVariables.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingVariables.join(", ")}`
  );
}

module.exports = config;
