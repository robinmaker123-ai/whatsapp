const mongoose = require("mongoose");

const userSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    refreshTokenHash: {
      type: String,
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    deviceName: {
      type: String,
      trim: true,
      default: "",
    },
    platform: {
      type: String,
      trim: true,
      default: "",
    },
    appVersion: {
      type: String,
      trim: true,
      default: "",
    },
    appBuildNumber: {
      type: String,
      trim: true,
      default: "",
    },
    ipAddress: {
      type: String,
      trim: true,
      default: "",
    },
    userAgent: {
      type: String,
      trim: true,
      default: "",
    },
    isRevoked: {
      type: Boolean,
      default: false,
      index: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    lastUsedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.refreshTokenHash;
        return ret;
      },
    },
  }
);

userSessionSchema.index(
  {
    userId: 1,
    deviceId: 1,
    createdAt: -1,
  },
  {
    name: "user_session_device_lookup",
  }
);

module.exports = mongoose.model("UserSession", userSessionSchema);
