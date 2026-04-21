const mongoose = require("mongoose");

const { normalizeMessageStatus } = require("../utils/messagePayloads");

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "file"],
      default: "text",
      index: true,
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
    fileSize: {
      type: Number,
      default: null,
    },
    voiceNoteDuration: {
      type: Number,
      default: null,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    forwardedFrom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    timestamp: {
      type: Date,
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen", "read"],
      default: "sent",
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
    seenAt: {
      type: Date,
      default: null,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.senderId = ret.senderId.toString();
        ret.receiverId = ret.receiverId.toString();
        ret.text = String(ret.text || ret.message || "").trim();
        ret.createdAt = ret.createdAt || ret.timestamp || null;
        ret.status = normalizeMessageStatus(ret.status);
        ret.seenAt = ret.seenAt || ret.readAt || null;
        ret.replyTo = ret.replyTo ? ret.replyTo.toString() : null;
        ret.forwardedFrom = ret.forwardedFrom ? ret.forwardedFrom.toString() : null;
        ret.deletedFor = (ret.deletedFor || []).map((value) => value.toString());
        delete ret.message;
        delete ret.timestamp;
        delete ret.readAt;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

messageSchema.pre("validate", function syncLegacyFields(next) {
  const normalizedText = String(this.text || this.message || "").trim();

  this.text = normalizedText;
  this.message = normalizedText;
  this.status = normalizeMessageStatus(this.status);
  this.seenAt = this.seenAt || this.readAt || null;
  this.readAt = this.seenAt || this.readAt || null;
  this.timestamp = this.timestamp || this.createdAt || new Date();

  next();
});

messageSchema.path("text").validate(function validateMessage() {
  return Boolean(String(this.text || this.message || "").trim() || this.mediaUrl);
}, "Either message text or mediaUrl is required.");

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1, timestamp: 1 });

module.exports = mongoose.model("Message", messageSchema);
