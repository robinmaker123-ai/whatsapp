const mongoose = require("mongoose");

const appReleaseSchema = new mongoose.Schema(
  {
    version: {
      type: String,
      required: true,
      trim: true,
    },
    buildNumber: {
      type: Number,
      required: true,
      min: 1,
      index: true,
    },
    channel: {
      type: String,
      trim: true,
      default: "production",
      index: true,
    },
    platform: {
      type: String,
      trim: true,
      default: "android",
      index: true,
    },
    fileName: {
      type: String,
      trim: true,
      default: "",
    },
    apkUrl: {
      type: String,
      trim: true,
      default: "",
    },
    checksumSha256: {
      type: String,
      trim: true,
      default: "",
    },
    minimumSupportedBuildNumber: {
      type: Number,
      default: 1,
      min: 1,
    },
    releaseNotes: {
      type: [String],
      default: [],
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isLatest: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

appReleaseSchema.index(
  {
    platform: 1,
    channel: 1,
    version: 1,
    buildNumber: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model("AppRelease", appReleaseSchema);
