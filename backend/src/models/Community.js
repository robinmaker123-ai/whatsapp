const crypto = require("crypto");
const mongoose = require("mongoose");

const communitySchema = new mongoose.Schema(
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
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    memberIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    announcementGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null,
    },
    inviteCode: {
      type: String,
      trim: true,
      index: true,
      default: () => crypto.randomUUID(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.creatorId = ret.creatorId?.id || ret.creatorId?.toString?.() || "";
        ret.memberIds = (ret.memberIds || []).map((value) => value.id || value.toString());
        ret.announcementGroupId = ret.announcementGroupId
          ? ret.announcementGroupId.id || ret.announcementGroupId.toString()
          : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("Community", communitySchema);
