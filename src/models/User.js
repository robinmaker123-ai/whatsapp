const mongoose = require("mongoose");

const chatPreferenceSchema = new mongoose.Schema(
  {
    contactId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    pinnedAt: {
      type: Date,
      default: null,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    phoneHash: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
      default: "",
    },
    phoneHashSecure: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    profilePic: {
      type: String,
      trim: true,
      default: "",
    },
    about: {
      type: String,
      trim: true,
      default: "Hey there! I am using VideoApp.",
    },
    status: {
      type: String,
      enum: ["online", "offline"],
      default: "offline",
    },
    lastSeen: {
      type: Date,
      default: null,
    },
    themePreference: {
      type: String,
      enum: ["system", "light", "dark"],
      default: "system",
    },
    privacy: {
      readReceipts: {
        type: Boolean,
        default: true,
      },
      lastSeenVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
      statusVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "contacts",
      },
      profilePhotoVisibility: {
        type: String,
        enum: ["everyone", "contacts", "nobody"],
        default: "everyone",
      },
    },
    notifications: {
      messagePreview: {
        type: Boolean,
        default: true,
      },
      callAlerts: {
        type: Boolean,
        default: true,
      },
      vibrate: {
        type: Boolean,
        default: true,
      },
    },
    blockedContacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    matchedContactIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    contactSync: {
      lastSyncedAt: {
        type: Date,
        default: null,
      },
      syncedCount: {
        type: Number,
        default: 0,
      },
      matchedCount: {
        type: Number,
        default: 0,
      },
    },
    chatPreferences: {
      type: [chatPreferenceSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        ret.blockedContacts = (ret.blockedContacts || []).map((contactId) =>
          contactId.toString()
        );
        ret.matchedContactIds = (ret.matchedContactIds || []).map((contactId) =>
          contactId.toString()
        );
        delete ret._id;
        delete ret.__v;
        delete ret.phoneHash;
        delete ret.phoneHashSecure;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("User", userSchema);
