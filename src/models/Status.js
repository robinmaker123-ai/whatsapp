const mongoose = require("mongoose");

const statusViewerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    viewedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const statusSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "video"],
      default: "text",
      index: true,
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: "",
    },
    mediaName: {
      type: String,
      trim: true,
      default: "",
    },
    mediaMimeType: {
      type: String,
      trim: true,
      default: "",
    },
    backgroundColor: {
      type: String,
      trim: true,
      default: "#128C7E",
    },
    viewers: {
      type: [statusViewerSchema],
      default: [],
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.userId = ret.userId.toString();
        ret.viewers = (ret.viewers || []).map((viewer) => ({
          userId: viewer.userId.toString(),
          viewedAt: viewer.viewedAt,
        }));
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

statusSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Status", statusSchema);
