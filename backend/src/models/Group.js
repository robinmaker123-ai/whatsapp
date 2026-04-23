const crypto = require("crypto");
const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    communityId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Community",
      default: null,
      index: true,
    },
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    adminIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    isAnnouncementGroup: {
      type: Boolean,
      default: false,
    },
    inviteCode: {
      type: String,
      trim: true,
      index: true,
      default: () => crypto.randomUUID(),
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.communityId = ret.communityId ? ret.communityId.toString() : null;
        ret.creatorId = ret.creatorId?.id || ret.creatorId?.toString?.() || "";
        ret.adminIds = (ret.adminIds || []).map((value) => value.id || value.toString());
        ret.memberIds = (ret.memberIds || []).map((value) => value.id || value.toString());
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("Group", groupSchema);
