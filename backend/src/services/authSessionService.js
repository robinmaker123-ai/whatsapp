const crypto = require("crypto");

const config = require("../config/env");
const UserSession = require("../models/UserSession");
const {
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  verifyRefreshToken,
} = require("../utils/authTokens");

const safeString = (value) => String(value || "").trim();

const buildSessionFingerprint = (req) => {
  const userAgent = safeString(req.headers["user-agent"]).slice(0, 400);
  const deviceId =
    safeString(req.headers["x-device-id"]) ||
    crypto
      .createHash("sha256")
      .update(`${safeString(req.ip)}:${userAgent}`)
      .digest("hex")
      .slice(0, 32);

  return {
    deviceId,
    deviceName: safeString(req.headers["x-device-name"]).slice(0, 120),
    platform: safeString(req.headers["x-platform"]).slice(0, 60),
    appVersion: safeString(req.headers["x-app-version"]).slice(0, 40),
    appBuildNumber: safeString(req.headers["x-app-build"]).slice(0, 20),
    ipAddress: safeString(req.ip).slice(0, 120),
    userAgent,
  };
};

const calculateFutureDate = (durationDays) =>
  new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

const parseRefreshExpiryDays = () => {
  const rawValue = String(config.refreshTokenExpiresIn || "30d").trim();
  const match = rawValue.match(/^(\d+)\s*d$/i);

  if (!match) {
    return 30;
  }

  return Number(match[1]) || 30;
};

const serializeSession = (sessionDoc) => {
  if (!sessionDoc) {
    return null;
  }

  return {
    id: sessionDoc.id,
    deviceId: sessionDoc.deviceId,
    deviceName: sessionDoc.deviceName,
    platform: sessionDoc.platform,
    appVersion: sessionDoc.appVersion,
    appBuildNumber: sessionDoc.appBuildNumber,
    ipAddress: sessionDoc.ipAddress,
    userAgent: sessionDoc.userAgent,
    isRevoked: sessionDoc.isRevoked,
    revokedAt: sessionDoc.revokedAt,
    expiresAt: sessionDoc.expiresAt,
    lastUsedAt: sessionDoc.lastUsedAt,
    createdAt: sessionDoc.createdAt,
    updatedAt: sessionDoc.updatedAt,
  };
};

const issueSessionTokens = async (userId, req) => {
  const fingerprint = buildSessionFingerprint(req);
  const expiresAt = calculateFutureDate(parseRefreshExpiryDays());

  const sessionDoc = await UserSession.create({
    userId,
    refreshTokenHash: "pending",
    expiresAt,
    ...fingerprint,
  });

  const accessToken = generateAccessToken(userId, sessionDoc.id);
  const refreshToken = generateRefreshToken(userId, sessionDoc.id);

  sessionDoc.refreshTokenHash = hashToken(refreshToken);
  sessionDoc.lastUsedAt = new Date();
  await sessionDoc.save();

  return {
    accessToken,
    refreshToken,
    session: serializeSession(sessionDoc),
  };
};

const rotateRefreshSession = async (refreshToken, req) => {
  const decoded = verifyRefreshToken(refreshToken);
  const sessionDoc = await UserSession.findById(decoded.sessionId);

  if (!sessionDoc || sessionDoc.isRevoked) {
    throw new Error("Session is no longer active.");
  }

  if (sessionDoc.expiresAt.getTime() <= Date.now()) {
    sessionDoc.isRevoked = true;
    sessionDoc.revokedAt = new Date();
    await sessionDoc.save();
    throw new Error("Refresh token expired.");
  }

  if (sessionDoc.refreshTokenHash !== hashToken(refreshToken)) {
    sessionDoc.isRevoked = true;
    sessionDoc.revokedAt = new Date();
    await sessionDoc.save();
    throw new Error("Refresh token does not match the active session.");
  }

  const nextAccessToken = generateAccessToken(decoded.userId, sessionDoc.id);
  const nextRefreshToken = generateRefreshToken(decoded.userId, sessionDoc.id);
  const fingerprint = buildSessionFingerprint(req);

  sessionDoc.refreshTokenHash = hashToken(nextRefreshToken);
  sessionDoc.lastUsedAt = new Date();
  sessionDoc.deviceName = fingerprint.deviceName || sessionDoc.deviceName;
  sessionDoc.platform = fingerprint.platform || sessionDoc.platform;
  sessionDoc.appVersion = fingerprint.appVersion || sessionDoc.appVersion;
  sessionDoc.appBuildNumber =
    fingerprint.appBuildNumber || sessionDoc.appBuildNumber;
  sessionDoc.ipAddress = fingerprint.ipAddress || sessionDoc.ipAddress;
  sessionDoc.userAgent = fingerprint.userAgent || sessionDoc.userAgent;
  await sessionDoc.save();

  return {
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    session: serializeSession(sessionDoc),
    decoded,
  };
};

const revokeSession = async (sessionId) => {
  const sessionDoc = await UserSession.findById(sessionId);

  if (!sessionDoc) {
    return null;
  }

  sessionDoc.isRevoked = true;
  sessionDoc.revokedAt = new Date();
  await sessionDoc.save();

  return sessionDoc;
};

module.exports = {
  buildSessionFingerprint,
  issueSessionTokens,
  revokeSession,
  rotateRefreshSession,
  serializeSession,
};
