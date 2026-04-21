const mongoose = require("mongoose");

const config = require("../config/env");
const Message = require("../models/Message");
const User = require("../models/User");
const { serializeMessage } = require("../utils/messagePayloads");
const asyncHandler = require("../utils/asyncHandler");
const { hashPhone } = require("../utils/phoneHash");

const buildChatPreferenceMap = (chatPreferences = []) =>
  new Map(
    chatPreferences.map((preference) => [
      preference.contactId.toString(),
      {
        isPinned: preference.isPinned,
        isArchived: preference.isArchived,
        pinnedAt: preference.pinnedAt,
        archivedAt: preference.archivedAt,
      },
    ])
  );

const CONTACT_HASH_REGEX = /^[a-f0-9]{64}$/;

const normalizeHash = (value = "") => String(value || "").trim().toLowerCase();

const parseContactHashes = (contacts = []) => {
  const dedupedContacts = new Map();

  contacts.forEach((entry) => {
    if (!entry) {
      return;
    }

    const hashSource =
      typeof entry === "string"
        ? entry
        : entry.hash || entry.phoneHash || hashPhone(entry.phone || "");
    const hash = normalizeHash(hashSource);

    if (!CONTACT_HASH_REGEX.test(hash)) {
      return;
    }

    if (dedupedContacts.has(hash)) {
      return;
    }

    const displayName =
      typeof entry === "object"
        ? String(entry.displayName || entry.name || entry.label || "").trim()
        : "";
    const phone =
      typeof entry === "object" ? String(entry.phone || entry.phoneNumber || "").trim() : "";

    dedupedContacts.set(hash, {
      hash,
      displayName,
      phone,
    });
  });

  return Array.from(dedupedContacts.values());
};

const buildInviteLink = () => {
  const websiteUrl = String(config.websiteUrl || "").trim();

  if (!websiteUrl) {
    return "";
  }

  return `${websiteUrl.replace(/\/+$/, "")}/download`;
};

const findMatchedUsersByHashes = async (currentUserId, contacts = []) => {
  const hashes = contacts.map((entry) => entry.hash);

  if (hashes.length === 0) {
    return {
      users: [],
      inviteCandidates: [],
    };
  }

  const matchedUsers = await User.find({
    _id: {
      $ne: currentUserId,
    },
    phoneHash: {
      $in: hashes,
    },
  })
    .select(
      "name phone phoneHash profilePic about status lastSeen themePreference privacy notifications blockedContacts"
    )
    .sort({ name: 1, createdAt: 1 });

  const usersByHash = new Map(
    matchedUsers
      .filter((userDoc) => userDoc.phoneHash)
      .map((userDoc) => [userDoc.phoneHash, userDoc])
  );
  const inviteLink = buildInviteLink();
  const inviteCandidates = contacts
    .filter((entry) => !usersByHash.has(entry.hash))
    .map((entry) => ({
      hash: entry.hash,
      displayName: entry.displayName || "Contact",
      phone: entry.phone,
      inviteLink,
      inviteMessage: inviteLink
        ? `Join me on VideoApp: ${inviteLink}`
        : "Join me on VideoApp.",
    }));

  return {
    users: matchedUsers,
    inviteCandidates,
  };
};

const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  res.status(200).json({ user });
});

const getUsers = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const search = String(req.query.search || "").trim();
  const filters = {
    _id: {
      $ne: currentUserId,
    },
    blockedContacts: {
      $ne: currentUserId,
    },
  };

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { about: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filters).sort({ name: 1, createdAt: 1 });

  res.status(200).json({ users });
});

const getChatList = asyncHandler(async (req, res) => {
  const currentUserId = new mongoose.Types.ObjectId(req.user.id);
  const includeArchived = String(req.query.archived || "").toLowerCase() === "true";
  const search = String(req.query.search || "").trim();
  const currentUser = await User.findById(req.user.id).select(
    "chatPreferences blockedContacts"
  );
  const blockedContactIds = currentUser?.blockedContacts || [];
  const chatPreferenceMap = buildChatPreferenceMap(currentUser?.chatPreferences);
  const userQuery = {
    _id: {
      $nin: blockedContactIds,
      $ne: currentUserId,
    },
  };

  if (search) {
    userQuery.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { about: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(userQuery).sort({ name: 1, createdAt: 1 });

  const chatSummaries = await Message.aggregate([
    {
      $match: {
        $and: [
          {
            $or: [{ senderId: currentUserId }, { receiverId: currentUserId }],
          },
          {
            deletedFor: {
              $ne: currentUserId,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        sortDate: {
          $ifNull: ["$createdAt", "$timestamp"],
        },
        otherUserId: {
          $cond: [{ $eq: ["$senderId", currentUserId] }, "$receiverId", "$senderId"],
        },
        unreadContribution: {
          $cond: [
            {
              $and: [
                { $eq: ["$receiverId", currentUserId] },
                {
                  $not: [
                    {
                      $in: ["$status", ["seen", "read"]],
                    },
                  ],
                },
              ],
            },
            1,
            0,
          ],
        },
      },
    },
    {
      $sort: {
        sortDate: -1,
      },
    },
    {
      $group: {
        _id: "$otherUserId",
        lastMessage: { $first: "$$ROOT" },
        unreadCount: { $sum: "$unreadContribution" },
      },
    },
  ]);

  const summaryMap = new Map(
    chatSummaries.map((summary) => [summary._id.toString(), summary])
  );

  const chats = users
    .map((user) => {
      const summary = summaryMap.get(user.id);
      const preferences = chatPreferenceMap.get(user.id) || {
        isPinned: false,
        isArchived: false,
        pinnedAt: null,
        archivedAt: null,
      };

      return {
        user,
        lastMessage: summary ? serializeMessage(summary.lastMessage) : null,
        unreadCount: summary ? summary.unreadCount : 0,
        isPinned: preferences.isPinned,
        isArchived: preferences.isArchived,
        pinnedAt: preferences.pinnedAt,
      };
    })
    .filter((chat) => chat.isArchived === includeArchived)
    .sort((firstChat, secondChat) => {
      if (firstChat.isPinned !== secondChat.isPinned) {
        return firstChat.isPinned ? -1 : 1;
      }

      const firstTimestamp = firstChat.lastMessage
        ? new Date(firstChat.lastMessage.createdAt).getTime()
        : 0;
      const secondTimestamp = secondChat.lastMessage
        ? new Date(secondChat.lastMessage.createdAt).getTime()
        : 0;

      if (firstTimestamp !== secondTimestamp) {
        return secondTimestamp - firstTimestamp;
      }

      return firstChat.user.name.localeCompare(secondChat.user.name);
    });

  res.status(200).json({ chats });
});

const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  const nextName = typeof req.body.name === "string" ? req.body.name.trim() : "";
  const nextAbout = typeof req.body.about === "string" ? req.body.about.trim() : "";
  const nextProfilePic =
    typeof req.body.profilePic === "string" ? req.body.profilePic.trim() : "";

  if (nextName) {
    user.name = nextName;
  }

  if (nextAbout) {
    user.about = nextAbout;
  }

  if (nextProfilePic) {
    user.profilePic = nextProfilePic;
  }

  await user.save();

  res.status(200).json({ user });
});

const updateSettings = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  const themePreference = String(req.body.themePreference || "").trim();

  if (["light", "dark", "system"].includes(themePreference)) {
    user.themePreference = themePreference;
  }

  if (req.body.privacy && typeof req.body.privacy === "object") {
    user.privacy = {
      ...user.privacy.toObject(),
      ...req.body.privacy,
    };
  }

  if (req.body.notifications && typeof req.body.notifications === "object") {
    user.notifications = {
      ...user.notifications.toObject(),
      ...req.body.notifications,
    };
  }

  await user.save();

  res.status(200).json({ user });
});

const updateChatPreferences = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const contactId = String(req.params.userId || "").trim();

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    res.status(400);
    throw new Error("A valid contact id is required.");
  }

  const existingPreference =
    user.chatPreferences.find(
      (preference) => preference.contactId.toString() === contactId
    ) || null;
  const nextPinned = req.body.isPinned;
  const nextArchived = req.body.isArchived;

  if (!existingPreference) {
    user.chatPreferences.push({
      contactId,
      isPinned: Boolean(nextPinned),
      isArchived: Boolean(nextArchived),
      pinnedAt: nextPinned ? new Date() : null,
      archivedAt: nextArchived ? new Date() : null,
    });
  } else {
    if (typeof nextPinned === "boolean") {
      existingPreference.isPinned = nextPinned;
      existingPreference.pinnedAt = nextPinned ? new Date() : null;
    }

    if (typeof nextArchived === "boolean") {
      existingPreference.isArchived = nextArchived;
      existingPreference.archivedAt = nextArchived ? new Date() : null;
    }
  }

  await user.save();

  res.status(200).json({
    chatPreferences: user.chatPreferences,
  });
});

const updateBlockedContacts = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  const contactId = String(req.params.userId || "").trim();
  const shouldBlock = Boolean(req.body.isBlocked);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  if (!mongoose.Types.ObjectId.isValid(contactId)) {
    res.status(400);
    throw new Error("A valid contact id is required.");
  }

  const blocked = new Set(user.blockedContacts.map((value) => value.toString()));

  if (shouldBlock) {
    blocked.add(contactId);
  } else {
    blocked.delete(contactId);
  }

  user.blockedContacts = Array.from(blocked);
  await user.save();

  res.status(200).json({
    blockedContacts: user.blockedContacts,
  });
});

const getMatchedContacts = asyncHandler(async (req, res) => {
  const currentUser = await User.findById(req.user.id).select(
    "matchedContactIds contactSync"
  );

  if (!currentUser) {
    res.status(404);
    throw new Error("User not found.");
  }

  const rawHashes = String(req.query.hashes || "").trim();

  if (rawHashes) {
    const contacts = parseContactHashes(
      rawHashes
        .split(",")
        .map((hashValue) => ({
          hash: hashValue,
        }))
    );
    const { users, inviteCandidates } = await findMatchedUsersByHashes(req.user.id, contacts);

    currentUser.matchedContactIds = users.map((userDoc) => userDoc._id);
    currentUser.contactSync = {
      lastSyncedAt: new Date(),
      syncedCount: contacts.length,
      matchedCount: users.length,
    };
    await currentUser.save();

    res.status(200).json({
      users,
      inviteCandidates,
      syncedCount: contacts.length,
      matchedCount: users.length,
      syncedAt: currentUser.contactSync.lastSyncedAt,
    });
    return;
  }

  const search = String(req.query.search || "").trim();
  const filters = {
    _id: {
      $in: currentUser.matchedContactIds || [],
      $ne: req.user.id,
    },
  };

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { about: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filters).sort({ name: 1, createdAt: 1 });

  res.status(200).json({
    users,
    syncedCount: currentUser.contactSync?.syncedCount || 0,
    matchedCount: currentUser.contactSync?.matchedCount || users.length,
    syncedAt: currentUser.contactSync?.lastSyncedAt || null,
  });
});

const syncMatchedContacts = asyncHandler(async (req, res) => {
  const contacts = parseContactHashes(Array.isArray(req.body.contacts) ? req.body.contacts : []);

  if (contacts.length === 0) {
    res.status(400);
    throw new Error("At least one valid contact hash is required.");
  }

  const currentUser = await User.findById(req.user.id).select(
    "matchedContactIds contactSync"
  );

  if (!currentUser) {
    res.status(404);
    throw new Error("User not found.");
  }

  const { users, inviteCandidates } = await findMatchedUsersByHashes(req.user.id, contacts);

  currentUser.matchedContactIds = users.map((userDoc) => userDoc._id);
  currentUser.contactSync = {
    lastSyncedAt: new Date(),
    syncedCount: contacts.length,
    matchedCount: users.length,
  };
  await currentUser.save();

  res.status(200).json({
    users,
    inviteCandidates,
    syncedCount: contacts.length,
    matchedCount: users.length,
    syncedAt: currentUser.contactSync.lastSyncedAt,
  });
});

module.exports = {
  getProfile,
  getUsers,
  getMatchedContacts,
  getChatList,
  syncMatchedContacts,
  updateBlockedContacts,
  updateChatPreferences,
  updateProfile,
  updateSettings,
};
