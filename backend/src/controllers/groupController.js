const mongoose = require("mongoose");

const Community = require("../models/Community");
const Group = require("../models/Group");
const config = require("../config/env");
const asyncHandler = require("../utils/asyncHandler");

const buildInviteLink = (inviteCode) => {
  const websiteUrl = String(config.websiteUrl || "").trim().replace(/\/+$/, "");

  if (!websiteUrl) {
    return "";
  }

  return `${websiteUrl}/#/download?group=${inviteCode}`;
};

const uniqueIds = (values = []) =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter((value) => mongoose.Types.ObjectId.isValid(value))
    )
  );

const serializeGroup = (groupDoc) => {
  const payload = typeof groupDoc.toJSON === "function" ? groupDoc.toJSON() : groupDoc;

  return {
    ...payload,
    inviteLink: buildInviteLink(payload.inviteCode),
  };
};

const getGroups = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const search = String(req.query.search || "").trim();
  const communityId = String(req.query.communityId || "").trim();
  const filters = {
    $or: [{ creatorId: currentUserId }, { memberIds: currentUserId }, { adminIds: currentUserId }],
  };

  if (communityId && mongoose.Types.ObjectId.isValid(communityId)) {
    filters.communityId = communityId;
  }

  if (search) {
    filters.$and = [
      {
        $or: [{ creatorId: currentUserId }, { memberIds: currentUserId }, { adminIds: currentUserId }],
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

  const groups = await Group.find(filters).sort({ updatedAt: -1, createdAt: -1 });

  res.status(200).json({
    groups: groups.map((groupDoc) => serializeGroup(groupDoc)),
  });
});

const createGroup = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const avatarUrl = String(req.body.avatarUrl || "").trim();
  const communityId = String(req.body.communityId || "").trim();
  const isAnnouncementGroup = Boolean(req.body.isAnnouncementGroup);
  const creatorId = req.user.id;

  if (!name) {
    res.status(400);
    throw new Error("A group name is required.");
  }

  if (communityId && !mongoose.Types.ObjectId.isValid(communityId)) {
    res.status(400);
    throw new Error("A valid communityId is required.");
  }

  if (communityId) {
    const community = await Community.findById(communityId);

    if (!community) {
      res.status(404);
      throw new Error("Community not found.");
    }
  }

  const memberIds = uniqueIds([creatorId, ...(Array.isArray(req.body.memberIds) ? req.body.memberIds : [])]);

  const group = await Group.create({
    name,
    description,
    avatarUrl,
    communityId: communityId || null,
    creatorId,
    adminIds: [creatorId],
    memberIds,
    isAnnouncementGroup,
  });

  res.status(201).json({
    group: serializeGroup(group),
  });
});

module.exports = {
  createGroup,
  getGroups,
};
