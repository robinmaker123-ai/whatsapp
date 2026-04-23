const crypto = require("crypto");

const jwt = require("jsonwebtoken");

const config = require("../config/env");

const ACCESS_TOKEN_TYPE = "access";
const REFRESH_TOKEN_TYPE = "refresh";
const ADMIN_TOKEN_TYPE = "admin";

const signToken = (payload, secret, expiresIn) =>
  jwt.sign(payload, secret, {
    expiresIn,
  });

const generateAccessToken = (userId, sessionId) =>
  signToken(
    {
      userId,
      sessionId,
      type: ACCESS_TOKEN_TYPE,
    },
    config.jwtSecret,
    config.jwtExpiresIn
  );

const generateRefreshToken = (userId, sessionId) =>
  signToken(
    {
      userId,
      sessionId,
      type: REFRESH_TOKEN_TYPE,
    },
    config.refreshTokenSecret,
    config.refreshTokenExpiresIn
  );

const generateAdminToken = (adminId) =>
  signToken(
    {
      adminId,
      type: ADMIN_TOKEN_TYPE,
    },
    config.adminJwtSecret,
    config.adminJwtExpiresIn
  );

const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, config.jwtSecret);

  if (decoded.type !== ACCESS_TOKEN_TYPE) {
    throw new Error("Invalid access token.");
  }

  return decoded;
};

const verifyRefreshToken = (token) => {
  const decoded = jwt.verify(token, config.refreshTokenSecret);

  if (decoded.type !== REFRESH_TOKEN_TYPE) {
    throw new Error("Invalid refresh token.");
  }

  return decoded;
};

const verifyAdminToken = (token) => {
  const decoded = jwt.verify(token, config.adminJwtSecret);

  if (decoded.type !== ADMIN_TOKEN_TYPE) {
    throw new Error("Invalid admin token.");
  }

  return decoded;
};

const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token || "")).digest("hex");

module.exports = {
  generateAccessToken,
  generateAdminToken,
  generateRefreshToken,
  hashToken,
  verifyAccessToken,
  verifyAdminToken,
  verifyRefreshToken,
};
