const AppRelease = require("../models/AppRelease");
const AdminAnnouncement = require("../models/AdminAnnouncement");
const ErrorLog = require("../models/ErrorLog");
const Message = require("../models/Message");
const User = require("../models/User");
const UserReport = require("../models/UserReport");
const UserSession = require("../models/UserSession");
const asyncHandler = require("../utils/asyncHandler");
const config = require("../config/env");
const { verifyPassword } = require("../utils/passwordHash");
const { generateAdminToken } = require("../utils/authTokens");
const {
  DEFAULT_PLATFORM,
  findLatestRelease,
  listReleases,
  normalizeChannel,
  normalizeReleaseNotes,
  serializeRelease,
} = require("../services/releaseService");
const { optionalInteger, optionalString, requiredString, trimmedString } = require("../utils/requestValidation");

const parseSocketStats = (req) => {
  const io = req.app.get("io");

  if (!io) {
    return {
      activeUsersLive: 0,
      activeSocketConnections: 0,
    };
  }

  return {
    activeUsersLive:
      typeof io.getActiveUserCount === "function" ? io.getActiveUserCount() : 0,
    activeSocketConnections:
      typeof io.getActiveConnectionCount === "function"
        ? io.getActiveConnectionCount()
        : 0,
  };
};

const requireConfiguredAdmin = (res) => {
  if (!config.adminPasswordHash) {
    res.status(503);
    throw new Error(
      "Admin login is not configured. Set ADMIN_PASSWORD_HASH in the environment."
    );
  }
};

const loginAdmin = asyncHandler(async (req, res) => {
  requireConfiguredAdmin(res);

  const email = requiredString(req.body.email, "Admin email is required.").toLowerCase();
  const password = requiredString(req.body.password, "Admin password is required.", 500);

  if (email !== config.adminEmail.toLowerCase()) {
    res.status(401);
    throw new Error("Invalid admin credentials.");
  }

  if (!verifyPassword(password, config.adminPasswordHash)) {
    res.status(401);
    throw new Error("Invalid admin credentials.");
  }

  const token = generateAdminToken(email);

  res.status(200).json({
    token,
    admin: {
      id: email,
      email,
      name: config.adminName,
    },
  });
});

const getAdminOverview = asyncHandler(async (req, res) => {
  const latestRelease = await findLatestRelease("production");
  const [totalUsers, activeUsersDb, bannedUsers, totalMessages, openReports, totalReports, totalSessions, downloadAggregate, recentErrors, announcements] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: "online", isBanned: false }),
      User.countDocuments({ isBanned: true }),
      Message.countDocuments(),
      UserReport.countDocuments({ status: "open" }),
      UserReport.countDocuments(),
      UserSession.countDocuments({ isRevoked: false, expiresAt: { $gt: new Date() } }),
      AppRelease.aggregate([
        {
          $group: {
            _id: null,
            totalDownloads: { $sum: "$downloadCount" },
          },
        },
      ]),
      ErrorLog.find({})
        .sort({ createdAt: -1 })
        .limit(12),
      AdminAnnouncement.find({})
        .sort({ createdAt: -1 })
        .limit(10),
    ]);

  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const [messagesToday, deliveredMessages, seenMessages] = await Promise.all([
    Message.countDocuments({ createdAt: { $gte: dayStart } }),
    Message.countDocuments({ status: { $in: ["delivered", "seen", "read"] } }),
    Message.countDocuments({ status: { $in: ["seen", "read"] } }),
  ]);
  const socketStats = parseSocketStats(req);

  res.status(200).json({
    stats: {
      totalUsers,
      activeUsers: activeUsersDb,
      activeUsersLive: socketStats.activeUsersLive,
      activeSocketConnections: socketStats.activeSocketConnections,
      bannedUsers,
      totalMessages,
      messagesToday,
      deliveredMessages,
      seenMessages,
      openReports,
      totalReports,
      totalSessions,
      apkDownloads: downloadAggregate[0]?.totalDownloads || 0,
      errorLogCount: recentErrors.length,
    },
    latestRelease: latestRelease ? serializeRelease(req, latestRelease) : null,
    recentErrors: recentErrors.map((entry) => entry.toJSON()),
    announcements: announcements.map((entry) => entry.toJSON()),
  });
});

const listReportedUsers = asyncHandler(async (req, res) => {
  const limit = Math.max(1, Math.min(optionalInteger(req.query.limit, { min: 1, max: 100 }) || 50, 100));
  const status = trimmedString(req.query.status);
  const filters = status ? { status } : {};
  const reports = await UserReport.find(filters)
    .populate("reporterId", "name phone profilePic status")
    .populate("reportedUserId", "name phone profilePic status isBanned banReason")
    .sort({ createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    reports: reports.map((reportDoc) => reportDoc.toJSON()),
  });
});

const listUsers = asyncHandler(async (req, res) => {
  const search = optionalString(req.query.search, 120);
  const filters = {};

  if (search) {
    filters.$or = [
      { name: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
      { about: { $regex: search, $options: "i" } },
    ];
  }

  const users = await User.find(filters)
    .sort({ createdAt: -1 })
    .limit(100);

  res.status(200).json({
    users,
  });
});

const banUser = asyncHandler(async (req, res) => {
  const userId = requiredString(req.params.userId, "A valid userId is required.");
  const reason = optionalString(req.body.reason, 300) || "Banned by admin";
  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  user.isBanned = true;
  user.bannedAt = new Date();
  user.banReason = reason;
  user.bannedBy = req.admin.id;
  user.status = "offline";
  user.lastSeen = new Date();
  await user.save();

  await UserSession.updateMany(
    {
      userId: user.id,
      isRevoked: false,
    },
    {
      $set: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    }
  );

  const io = req.app.get("io");
  if (io && typeof io.disconnectUserConnections === "function") {
    io.disconnectUserConnections(user.id, "banned");
  }

  res.status(200).json({
    message: "User banned successfully.",
    user,
  });
});

const unbanUser = asyncHandler(async (req, res) => {
  const userId = requiredString(req.params.userId, "A valid userId is required.");
  const user = await User.findById(userId);

  if (!user) {
    res.status(404);
    throw new Error("User not found.");
  }

  user.isBanned = false;
  user.bannedAt = null;
  user.banReason = "";
  user.bannedBy = "";
  await user.save();

  res.status(200).json({
    message: "User unbanned successfully.",
    user,
  });
});

const broadcastAnnouncement = asyncHandler(async (req, res) => {
  const title = requiredString(req.body.title, "Announcement title is required.", 120);
  const message = requiredString(req.body.message, "Announcement message is required.", 1000);
  const level = trimmedString(req.body.level) || "info";
  const expiresInHours = Math.max(1, Math.min(optionalInteger(req.body.expiresInHours, { min: 1, max: 720 }) || 24, 720));

  if (!["info", "warning", "critical"].includes(level)) {
    res.status(400);
    throw new Error("A valid announcement level is required.");
  }

  const announcement = await AdminAnnouncement.create({
    title,
    message,
    level,
    createdBy: req.admin.id,
    activeUntil: new Date(Date.now() + expiresInHours * 60 * 60 * 1000),
  });

  const io = req.app.get("io");

  if (io) {
    io.emit("admin_announcement", announcement.toJSON());
  }

  res.status(201).json({
    message: "Announcement broadcasted successfully.",
    announcement: announcement.toJSON(),
  });
});

const listAnnouncements = asyncHandler(async (req, res) => {
  const announcements = await AdminAnnouncement.find({})
    .sort({ createdAt: -1 })
    .limit(50);

  res.status(200).json({
    announcements: announcements.map((entry) => entry.toJSON()),
  });
});

const listErrorLogs = asyncHandler(async (req, res) => {
  const limit = Math.max(1, Math.min(optionalInteger(req.query.limit, { min: 1, max: 200 }) || 100, 200));
  const level = trimmedString(req.query.level);
  const filters = level ? { level } : {};
  const logs = await ErrorLog.find(filters)
    .sort({ createdAt: -1 })
    .limit(limit);

  res.status(200).json({
    logs: logs.map((entry) => entry.toJSON()),
  });
});

const publishRelease = asyncHandler(async (req, res) => {
  const version = requiredString(req.body.version, "A release version is required.", 40);
  const buildNumber = optionalInteger(req.body.buildNumber, { min: 1, max: 999999 });
  const channel = normalizeChannel(req.body.channel);
  const apkUrl = requiredString(req.body.apkUrl, "An apkUrl is required.", 2000);
  const fileName = optionalString(req.body.fileName, 180);
  const checksumSha256 = optionalString(req.body.checksumSha256, 128).toLowerCase();
  const fileSizeBytes = optionalInteger(req.body.fileSizeBytes, { min: 0, max: 2_000_000_000 });
  const minimumSupportedBuildNumber = Math.max(
    1,
    optionalInteger(req.body.minimumSupportedBuildNumber, { min: 1, max: 999999 }) ||
      buildNumber ||
      1
  );
  const releaseNotes = normalizeReleaseNotes(req.body.releaseNotes);

  if (!buildNumber) {
    res.status(400);
    throw new Error("A valid buildNumber is required.");
  }

  try {
    new URL(apkUrl);
  } catch (error) {
    res.status(400);
    throw new Error("apkUrl must be a valid absolute URL.");
  }

  await AppRelease.updateMany(
    {
      channel,
      platform: DEFAULT_PLATFORM,
      isLatest: true,
    },
    {
      $set: {
        isLatest: false,
      },
    }
  );

  const release = await AppRelease.findOneAndUpdate(
    {
      channel,
      platform: DEFAULT_PLATFORM,
      version,
      buildNumber,
    },
    {
      $set: {
        fileName,
        apkUrl,
        checksumSha256,
        fileSizeBytes,
        minimumSupportedBuildNumber,
        releaseNotes,
        isLatest: true,
        publishedAt: new Date(),
      },
      $setOnInsert: {
        downloadCount: 0,
      },
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  res.status(201).json({
    message: "Release published successfully.",
    release: serializeRelease(req, release.toJSON()),
  });
});

const getReleaseManagement = asyncHandler(async (req, res) => {
  const releases = await listReleases(req.query.channel || "production", 30);

  res.status(200).json({
    releases: releases.map((entry) => serializeRelease(req, entry)),
  });
});

module.exports = {
  banUser,
  broadcastAnnouncement,
  getAdminOverview,
  getReleaseManagement,
  listAnnouncements,
  listErrorLogs,
  listReportedUsers,
  listUsers,
  loginAdmin,
  publishRelease,
  unbanUser,
};
