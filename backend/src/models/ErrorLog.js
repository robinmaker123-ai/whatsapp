const mongoose = require("mongoose");

const errorLogSchema = new mongoose.Schema(
  {
    level: {
      type: String,
      trim: true,
      default: "error",
      index: true,
    },
    message: {
      type: String,
      trim: true,
      required: true,
    },
    stack: {
      type: String,
      default: "",
    },
    statusCode: {
      type: Number,
      default: 500,
      index: true,
    },
    path: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    method: {
      type: String,
      trim: true,
      default: "",
    },
    requestId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.userId = ret.userId ? ret.userId.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

errorLogSchema.index(
  {
    createdAt: -1,
    level: 1,
  },
  {
    name: "error_log_recent_lookup",
  }
);

module.exports = mongoose.model("ErrorLog", errorLogSchema);
