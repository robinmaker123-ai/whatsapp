const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    codeHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    requestCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    verifyAttemptCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastRequestedAt: {
      type: Date,
      default: null,
    },
    blockedUntil: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Otp", otpSchema);
