const Status = require("../models/Status");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");

const ACTIVE_STATUS_WINDOW_MS = 24 * 60 * 60 * 1000;

const serializeStatus = (statusDoc) => ({
  id: statusDoc.id,
  userId: statusDoc.userId.id || statusDoc.userId.toString(),
  user:
    statusDoc.userId && typeof statusDoc.userId === "object" && statusDoc.userId.name
      ? statusDoc.userId
      : undefined,
  type: statusDoc.type,
  text: statusDoc.text,
  mediaUrl: statusDoc.mediaUrl,
  mediaName: statusDoc.mediaName,
  mediaMimeType: statusDoc.mediaMimeType,
  backgroundColor: statusDoc.backgroundColor,
  viewers: (statusDoc.viewers || []).map((viewer) => ({
    userId: viewer.userId.id || viewer.userId.toString(),
    user:
      viewer.userId && typeof viewer.userId === "object" && viewer.userId.name
        ? viewer.userId
        : undefined,
    viewedAt: viewer.viewedAt,
  })),
  expiresAt: statusDoc.expiresAt,
  createdAt: statusDoc.createdAt,
  updatedAt: statusDoc.updatedAt,
});

const pruneExpiredStatuses = async () => {
  await Status.deleteMany({
    expiresAt: {
      $lte: new Date(),
    },
  });
};

const createStatus = asyncHandler(async (req, res) => {
  const text = String(req.body.text || "").trim();
  const type = String(req.body.type || (req.body.mediaUrl ? "image" : "text")).trim();
  const mediaUrl = String(req.body.mediaUrl || "").trim();
  const mediaName = String(req.body.mediaName || "").trim();
  const mediaMimeType = String(req.body.mediaMimeType || "").trim();
  const backgroundColor = String(req.body.backgroundColor || "#128C7E").trim();

  if (!["text", "image", "video"].includes(type)) {
    res.status(400);
    throw new Error("A valid status type is required.");
  }

  if (!text && !mediaUrl) {
    res.status(400);
    throw new Error("Status text or media is required.");
  }

  const status = await Status.create({
    userId: req.user.id,
    type,
    text,
    mediaUrl,
    mediaName,
    mediaMimeType,
    backgroundColor,
    expiresAt: new Date(Date.now() + ACTIVE_STATUS_WINDOW_MS),
  });

  const populatedStatus = await status.populate("userId", "name phone profilePic about status");
  const io = req.app.get("io");

  if (io) {
    io.emit("status_created", serializeStatus(populatedStatus));
  }

  res.status(201).json({
    status: serializeStatus(populatedStatus),
  });
});

const getStatusFeed = asyncHandler(async (req, res) => {
  await pruneExpiredStatuses();

  const currentUser = await User.findById(req.user.id).select("blockedContacts");
  const blockedContacts = currentUser?.blockedContacts || [];

  const statuses = await Status.find({
    userId: {
      $nin: blockedContacts,
    },
    expiresAt: {
      $gt: new Date(),
    },
  })
    .populate("userId", "name phone profilePic about status lastSeen")
    .populate("viewers.userId", "name phone profilePic")
    .sort({ createdAt: -1 });

  const groupedFeed = new Map();

  statuses.forEach((statusDoc) => {
    const userId = statusDoc.userId.id || statusDoc.userId.toString();
    const existing = groupedFeed.get(userId) || {
      user: statusDoc.userId,
      statuses: [],
      latestStatusAt: statusDoc.createdAt,
      hasUnviewed: false,
    };

    existing.statuses.push(serializeStatus(statusDoc));
    existing.latestStatusAt = existing.latestStatusAt || statusDoc.createdAt;
    existing.hasUnviewed =
      existing.hasUnviewed ||
      !statusDoc.viewers.some((viewer) => {
        const viewerId = viewer.userId?.id || viewer.userId?.toString();
        return viewerId === req.user.id;
      });

    groupedFeed.set(userId, existing);
  });

  const mine = groupedFeed.get(req.user.id) || null;
  const feed = Array.from(groupedFeed.values()).filter(
    (entry) => entry.user.id !== req.user.id
  );

  res.status(200).json({
    mine,
    feed,
  });
});

const markStatusViewed = asyncHandler(async (req, res) => {
  const status = await Status.findById(req.params.statusId);

  if (!status) {
    res.status(404);
    throw new Error("Status not found.");
  }

  const viewerExists = status.viewers.some(
    (viewer) => viewer.userId.toString() === req.user.id
  );

  if (!viewerExists) {
    status.viewers.push({
      userId: req.user.id,
      viewedAt: new Date(),
    });
    await status.save();
  }

  const populatedStatus = await Status.findById(status.id)
    .populate("userId", "name phone profilePic about status lastSeen")
    .populate("viewers.userId", "name phone profilePic");

  res.status(200).json({
    status: serializeStatus(populatedStatus),
  });
});

const deleteStatus = asyncHandler(async (req, res) => {
  const status = await Status.findById(req.params.statusId);

  if (!status) {
    res.status(404);
    throw new Error("Status not found.");
  }

  if (status.userId.toString() !== req.user.id) {
    res.status(403);
    throw new Error("You can only delete your own statuses.");
  }

  await Status.deleteOne({ _id: status._id });

  res.status(200).json({
    success: true,
  });
});

module.exports = {
  createStatus,
  deleteStatus,
  getStatusFeed,
  markStatusViewed,
};
