const AdminAnnouncement = require("../models/AdminAnnouncement");
const AppRelease = require("../models/AppRelease");
const Community = require("../models/Community");
const Group = require("../models/Group");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { findLatestRelease, serializeRelease } = require("../services/releaseService");
const { loadProductConfig } = require("../services/productService");

const getSiteOverview = asyncHandler(async (req, res) => {
  const [productConfig, latestRelease, onlineUsersCount, communitiesCount, groupsCount, downloadAggregate, announcement] =
    await Promise.all([
      Promise.resolve(loadProductConfig()),
      findLatestRelease(req.query.channel),
      User.countDocuments({ status: "online" }),
      Community.countDocuments(),
      Group.countDocuments(),
      AppRelease.aggregate([
        {
          $group: {
            _id: null,
            totalDownloads: { $sum: "$downloadCount" },
          },
        },
      ]),
      AdminAnnouncement.findOne({
        $or: [{ activeUntil: null }, { activeUntil: { $gt: new Date() } }],
      }).sort({ createdAt: -1 }),
    ]);

  res.status(200).json({
    product: productConfig,
    stats: {
      onlineUsersCount,
      communitiesCount,
      groupsCount,
      totalDownloads: downloadAggregate[0]?.totalDownloads || 0,
    },
    release: latestRelease ? serializeRelease(req, latestRelease) : null,
    announcement: announcement ? announcement.toJSON() : null,
  });
});

module.exports = {
  getSiteOverview,
};
