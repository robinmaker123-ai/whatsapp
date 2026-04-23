const mongoose = require("mongoose");

const adminAnnouncementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
      required: true,
      maxlength: 120,
    },
    message: {
      type: String,
      trim: true,
      required: true,
      maxlength: 1000,
    },
    level: {
      type: String,
      trim: true,
      enum: ["info", "warning", "critical"],
      default: "info",
      index: true,
    },
    createdBy: {
      type: String,
      trim: true,
      default: "",
    },
    activeUntil: {
      type: Date,
      default: null,
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

module.exports = mongoose.model("AdminAnnouncement", adminAnnouncementSchema);
