const mongoose = require("mongoose");

const userReportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      required: true,
      enum: ["spam", "abuse", "fake", "harassment", "impersonation", "other"],
    },
    details: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1200,
    },
    status: {
      type: String,
      trim: true,
      enum: ["open", "reviewed", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    reviewedBy: {
      type: String,
      trim: true,
      default: "",
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

userReportSchema.index(
  {
    reporterId: 1,
    reportedUserId: 1,
    createdAt: -1,
  },
  {
    name: "user_report_lookup",
  }
);

module.exports = mongoose.model("UserReport", userReportSchema);
