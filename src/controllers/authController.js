const config = require("../config/env");
const Otp = require("../models/Otp");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const generateOtp = require("../utils/generateOtp");
const generateToken = require("../utils/generateToken");
const hashOtp = require("../utils/hashOtp");
const { hashPhone, hashPhoneSecure } = require("../utils/phoneHash");
const { isValidPhone, normalizePhone } = require("../utils/phone");

const sendOtp = asyncHandler(async (req, res) => {
  const normalizedPhone = normalizePhone(req.body.phone);

  if (!isValidPhone(normalizedPhone)) {
    res.status(400);
    throw new Error("A valid phone number is required.");
  }

  const otp = generateOtp();
  const expiresAt = new Date(
    Date.now() + config.otpTtlMinutes * 60 * 1000
  );

  await Otp.findOneAndUpdate(
    { phone: normalizedPhone },
    {
      phone: normalizedPhone,
      codeHash: hashOtp(otp),
      expiresAt,
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
  };

  if (config.enableDevOtpPreview) {
    response.mockOtp = otp;
  }

  res.status(200).json(response);
});

const verifyOtp = asyncHandler(async (req, res) => {
  const normalizedPhone = normalizePhone(req.body.phone);
  const otp = String(req.body.otp || "").trim();
  const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const profilePic =
    typeof req.body.profilePic === "string" ? req.body.profilePic.trim() : "";
  const about = typeof req.body.about === "string" ? req.body.about.trim() : "";

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

  if (otpRecord.expiresAt.getTime() < Date.now()) {
    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(400);
    throw new Error("OTP has expired. Please request a new OTP.");
  }

  if (otpRecord.codeHash !== hashOtp(otp)) {
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

  const token = generateToken(user.id);

  res.status(200).json({
    message: "OTP verified successfully.",
    token,
    user,
  });
});

module.exports = {
  sendOtp,
  verifyOtp,
};
