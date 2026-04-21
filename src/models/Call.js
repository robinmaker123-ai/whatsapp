const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    callerId: {
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
    type: {
      type: String,
      enum: ["voice", "video"],
      default: "voice",
    },
    status: {
      type: String,
      enum: ["ringing", "accepted", "rejected", "missed", "ended", "cancelled"],
      default: "ringing",
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    durationSeconds: {
      type: Number,
      default: 0,
    },
    endedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.callerId = ret.callerId.toString();
        ret.receiverId = ret.receiverId.toString();
        ret.endedBy = ret.endedBy ? ret.endedBy.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

callSchema.index({ callerId: 1, receiverId: 1, createdAt: -1 });

module.exports = mongoose.model("Call", callSchema);
