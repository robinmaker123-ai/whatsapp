const Community = require("../models/Community");
const Group = require("../models/Group");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");

const buildInviteLink = (inviteCode) => {
  const websiteUrl = String(config.websiteUrl || "").trim().replace(/\/+$/, "");

  if (!websiteUrl) {
    return "";
  }

  return `${websiteUrl}/#/download?community=${inviteCode}`;
};

const serializeCommunity = (communityDoc, groupsCount = 0) => {
  const payload = typeof communityDoc.toJSON === "function" ? communityDoc.toJSON() : communityDoc;
  const announcementGroup =
    payload.announcementGroupId && typeof payload.announcementGroupId === "object"
      ? payload.announcementGroupId
      : null;

  return {
    ...payload,
    announcementGroup: announcementGroup
      ? {
          id: announcementGroup.id,
          name: announcementGroup.name,
          memberIds: announcementGroup.memberIds || [],
          isAnnouncementGroup: true,
        }
      : null,
    announcementGroupId: announcementGroup ? announcementGroup.id : payload.announcementGroupId,
    inviteLink: buildInviteLink(payload.inviteCode),
    groupsCount,
  };
};

const getCommunities = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const search = String(req.query.search || "").trim();
  const filters = {
    $or: [{ creatorId: currentUserId }, { memberIds: currentUserId }],
  };

  if (search) {
    filters.$and = [
      {
        $or: [{ creatorId: currentUserId }, { memberIds: currentUserId }],
      },
      {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      },
    ];
    delete filters.$or;
  }

  const communities = await Community.find(filters)
    .populate("announcementGroupId", "name memberIds isAnnouncementGroup")
    .sort({ updatedAt: -1, createdAt: -1 });

  const communityIds = communities.map((communityDoc) => communityDoc._id);
  const groupCounts = await Group.aggregate([
    {
      $match: {
        communityId: {
          $in: communityIds,
        },
      },
    },
    {
      $group: {
        _id: "$communityId",
        count: {
          $sum: 1,
        },
      },
    },
  ]);

  const groupCountMap = new Map(
    groupCounts.map((entry) => [entry._id.toString(), entry.count || 0])
  );

  res.status(200).json({
    communities: communities.map((communityDoc) =>
      serializeCommunity(communityDoc, groupCountMap.get(communityDoc.id) || 0)
    ),
  });
});

const createCommunity = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const avatarUrl = String(req.body.avatarUrl || "").trim();

  if (!name) {
    res.status(400);
    throw new Error("A community name is required.");
  }

  const creatorId = req.user.id;
  const community = await Community.create({
    name,
    description,
    avatarUrl,
    creatorId,
    memberIds: [creatorId],
  });

  const announcementGroup = await Group.create({
    name: `${name} Announcements`,
    description: description || "Official community updates and important notices.",
    avatarUrl,
    communityId: community.id,
    creatorId,
    adminIds: [creatorId],
    memberIds: [creatorId],
    isAnnouncementGroup: true,
  });

  community.announcementGroupId = announcementGroup.id;
  await community.save();

  const populatedCommunity = await Community.findById(community.id).populate(
    "announcementGroupId",
    "name memberIds isAnnouncementGroup"
  );

  res.status(201).json({
    community: serializeCommunity(populatedCommunity, 1),
  });
});

module.exports = {
  createCommunity,
  getCommunities,
};
