const config = require("../config/env");
const Otp = require("../models/Otp");
const User = require("../models/User");
const UserSession = require("../models/UserSession");
const asyncHandler = require("../utils/asyncHandler");
const generateOtp = require("../utils/generateOtp");
const hashOtp = require("../utils/hashOtp");
const { hashPhone, hashPhoneSecure } = require("../utils/phoneHash");
const { isValidPhone, normalizePhone } = require("../utils/phone");
const {
  issueSessionTokens,
  revokeSession,
  rotateRefreshSession,
  serializeSession,
} = require("../services/authSessionService");
const { hashToken } = require("../utils/authTokens");
const { optionalString, requiredString, trimmedString } = require("../utils/requestValidation");

const buildSessionResponse = ({ accessToken, refreshToken, session, user }) => ({
  message: "Authentication successful.",
  token: accessToken,
  accessToken,
  refreshToken,
  session,
  user,
});

const sendOtp = asyncHandler(async (req, res) => {
  const normalizedPhone = normalizePhone(req.body.phone);

  if (!isValidPhone(normalizedPhone)) {
    res.status(400);
    throw new Error("A valid phone number is required.");
  }

  const existingOtp = await Otp.findOne({ phone: normalizedPhone });
  const now = Date.now();

  if (existingOtp?.blockedUntil && existingOtp.blockedUntil.getTime() > now) {
    res.status(429);
    throw new Error("OTP verification is temporarily locked. Please try again shortly.");
  }

  if (
    existingOtp?.lastRequestedAt &&
    now - existingOtp.lastRequestedAt.getTime() < config.otpRequestCooldownSeconds * 1000
  ) {
    res.status(429);
    throw new Error("Please wait before requesting another OTP.");
  }

  const otp = generateOtp();
  const expiresAt = new Date(now + config.otpTtlMinutes * 60 * 1000);

  await Otp.findOneAndUpdate(
    { phone: normalizedPhone },
    {
      phone: normalizedPhone,
      codeHash: hashOtp(otp),
      expiresAt,
      requestCount: (existingOtp?.requestCount || 0) + 1,
      verifyAttemptCount: 0,
      lastRequestedAt: new Date(now),
      blockedUntil: null,
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  const response = {
    message: "OTP sent successfully.",
    phone: normalizedPhone,
    expiresInMinutes: config.otpTtlMinutes,
    retryAfterSeconds: config.otpRequestCooldownSeconds,
  };

  if (config.enableDevOtpPreview) {
    response.mockOtp = otp;
  }

  res.status(200).json(response);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const normalizedPhone = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || "").trim();
  const name = optionalString(req.body.name, 80);
  const profilePic = optionalString(req.body.profilePic, 500);
  const about = optionalString(req.body.about, 180);

  if (!isValidPhone(normalizedPhone)) {
    res.status(400);
    throw new Error("A valid phone number is required.");
  }

  if (!/^\d{6}$/.test(otp)) {
    res.status(400);
    throw new Error("OTP must be a 6-digit code.");
  }

  const otpRecord = await Otp.findOne({ phone: normalizedPhone });

  if (!otpRecord) {
    res.status(400);
    throw new Error("OTP not found. Please request a new OTP.");
  }

  if (otpRecord.blockedUntil && otpRecord.blockedUntil.getTime() > Date.now()) {
    res.status(429);
    throw new Error("OTP verification is temporarily locked. Please request a new OTP later.");
  }

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(400);
    throw new Error("OTP has expired. Please request a new OTP.");
  }

  if (otpRecord.codeHash !== hashOtp(otp)) {
    otpRecord.verifyAttemptCount += 1;

    if (otpRecord.verifyAttemptCount >= config.otpMaxVerifyAttempts) {
      otpRecord.blockedUntil = new Date(Date.now() + config.otpTtlMinutes * 60 * 1000);
    }

    await otpRecord.save();
    res.status(400);
    throw new Error("Invalid OTP.");
  }

  await Otp.deleteOne({ _id: otpRecord._id });

  let user = await User.findOne({ phone: normalizedPhone });

  if (!user) {
    user = await User.create({
      phone: normalizedPhone,
      phoneHash: hashPhone(normalizedPhone),
      phoneHashSecure: hashPhoneSecure(normalizedPhone),
      name: name || `User ${normalizedPhone.slice(-4)}`,
      profilePic,
      about: about || "Hey there! I am using VideoApp.",
      status: "online",
      lastSeen: null,
    });
  } else {
    if (user.isBanned) {
      res.status(403);
      throw new Error(user.banReason || "Your account has been suspended.");
    }

    if (name) {
      user.name = name;
    } else if (!user.name) {
      user.name = `User ${normalizedPhone.slice(-4)}`;
    }

    if (profilePic) {
      user.profilePic = profilePic;
    }

    if (about) {
      user.about = about;
    }

    if (!user.phoneHash) {
      user.phoneHash = hashPhone(normalizedPhone);
    }

    if (!user.phoneHashSecure) {
      user.phoneHashSecure = hashPhoneSecure(normalizedPhone);
    }

    user.status = "online";
    user.lastSeen = null;
    await user.save();
  }

  const sessionTokens = await issueSessionTokens(user.id, req);

  res.status(200).json(
    buildSessionResponse({
      ...sessionTokens,
      user,
    })
  );
});

const refreshSession = asyncHandler(async (req, res) => {
  const refreshToken = requiredString(
    req.body.refreshToken,
    "A refreshToken is required."
  );
  const rotatedSession = await rotateRefreshSession(refreshToken, req);
  const user = await User.findById(rotatedSession.decoded.userId);

  if (!user) {
    res.status(401);
    throw new Error("User not found.");
  }

  if (user.isBanned) {
    res.status(403);
    throw new Error(user.banReason || "Your account has been suspended.");
  }

  res.status(200).json(
    buildSessionResponse({
      accessToken: rotatedSession.accessToken,
      refreshToken: rotatedSession.refreshToken,
      session: rotatedSession.session,
      user,
    })
  );
});

const getSessions = asyncHandler(async (req, res) => {
  const sessions = await UserSession.find({
    userId: req.user.id,
  }).sort({ lastUsedAt: -1, createdAt: -1 });

  res.status(200).json({
    sessions: sessions.map((sessionDoc) => ({
      ...serializeSession(sessionDoc),
      isCurrent: sessionDoc.id === req.authSession?.id,
    })),
  });
});

const revokeCurrentSession = asyncHandler(async (req, res) => {
  if (!req.authSession?.id) {
    res.status(400);
    throw new Error("No active session was found.");
  }

  await revokeSession(req.authSession.id);

  res.status(200).json({
    message: "Session signed out successfully.",
  });
});

const revokeSessionById = asyncHandler(async (req, res) => {
  const sessionId = trimmedString(req.params.sessionId);
  const sessionDoc = await UserSession.findById(sessionId);

  if (!sessionDoc || sessionDoc.userId.toString() !== req.user.id) {
    res.status(404);
    throw new Error("Session not found.");
  }

  await revokeSession(sessionId);

  res.status(200).json({
    message: "Session revoked successfully.",
  });
});

const revokeSessionByRefreshToken = asyncHandler(async (req, res) => {
  const refreshToken = requiredString(
    req.body.refreshToken,
    "A refreshToken is required."
  );
  const sessionDoc = await UserSession.findOne({
    refreshTokenHash: hashToken(refreshToken),
  });

  if (!sessionDoc) {
    res.status(404);
    throw new Error("Session not found.");
  }

  if (req.user && sessionDoc.userId.toString() !== req.user.id) {
    res.status(403);
    throw new Error("You can only revoke your own sessions.");
  }

  await revokeSession(sessionDoc.id);

  res.status(200).json({
    message: "Refresh session revoked successfully.",
  });
});

module.exports = {
  getSessions,
  refreshSession,
  revokeCurrentSession,
  revokeSessionById,
  revokeSessionByRefreshToken,
  sendOtp,
  verifyOtp,
};
