const User = require("../models/User");
const UserSession = require("../models/UserSession");
const {
  verifyAccessToken,
  verifyAdminToken,
} = require("../utils/authTokens");

const parseBearerToken = (headerValue = "") => {
  const normalizedValue = String(headerValue || "").trim();

  if (!normalizedValue.toLowerCase().startsWith("bearer ")) {
    return "";
  }

  return normalizedValue.slice(7).trim();
};

const extractBearerToken = (req) =>
  parseBearerToken(req.headers.authorization || req.headers.Authorization || "");

const protect = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      res.status(401);
      throw new Error("Not authorized. Token is missing.");
    }

    const decoded = verifyAccessToken(token);
    const [user, sessionDoc] = await Promise.all([
      User.findById(decoded.userId),
      decoded.sessionId ? UserSession.findById(decoded.sessionId) : Promise.resolve(null),
    ]);

    if (!user) {
      res.status(401);
      throw new Error("Not authorized. User does not exist.");
    }

    if (user.isBanned) {
      res.status(403);
      throw new Error(user.banReason || "Your account has been suspended.");
    }

    if (!sessionDoc || sessionDoc.isRevoked || sessionDoc.userId.toString() !== user.id) {
      res.status(401);
      throw new Error("Session expired. Please sign in again.");
    }

    if (sessionDoc.expiresAt.getTime() <= Date.now()) {
      sessionDoc.isRevoked = true;
      sessionDoc.revokedAt = new Date();
      await sessionDoc.save();

      res.status(401);
      throw new Error("Session expired. Please sign in again.");
    }

    sessionDoc.lastUsedAt = new Date();
    await sessionDoc.save();

    req.user = user;
    req.authSession = sessionDoc;
    next();
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(401);
    }

    next(error);
  }
};

const requireAdmin = async (req, res, next) => {
  try {
    const token = extractBearerToken(req);

    if (!token) {
      res.status(401);
      throw new Error("Admin token is required.");
    }

    const decoded = verifyAdminToken(token);

    req.admin = {
      id: decoded.adminId,
    };
    next();
  } catch (error) {
    if (res.statusCode === 200) {
      res.status(401);
    }

    next(error);
  }
};

module.exports = {
  extractBearerToken,
  parseBearerToken,
  protect,
  requireAdmin,
};
