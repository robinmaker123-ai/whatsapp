const crypto = require("crypto");
const mongoose = require("mongoose");

const Call = require("../models/Call");
const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const { canUserCall } = require("../utils/moderation");

const getUserRoom = (userId) => `user:${userId}`;

const serializeCall = (callDoc, currentUserId) => {
  const callerId = callDoc.callerId.id || callDoc.callerId.toString();
  const receiverId = callDoc.receiverId.id || callDoc.receiverId.toString();
  const isOutgoing = callerId === currentUserId;
  const contact = isOutgoing ? callDoc.receiverId : callDoc.callerId;

  return {
    id: callDoc.id,
    callerId,
    receiverId,
    type: callDoc.type,
    status: callDoc.status,
    roomId: callDoc.roomId,
    startedAt: callDoc.startedAt,
    endedAt: callDoc.endedAt,
    durationSeconds: callDoc.durationSeconds,
    direction: isOutgoing ? "outgoing" : "incoming",
    contact:
      contact && typeof contact === "object" && contact.name ? contact : undefined,
    createdAt: callDoc.createdAt,
    updatedAt: callDoc.updatedAt,
  };
};

const getCalls = asyncHandler(async (req, res) => {
  const calls = await Call.find({
    $or: [{ callerId: req.user.id }, { receiverId: req.user.id }],
  })
    .populate("callerId", "name phone profilePic about status lastSeen")
    .populate("receiverId", "name phone profilePic about status lastSeen")
    .sort({ createdAt: -1 });

  res.status(200).json({
    calls: calls.map((callDoc) => serializeCall(callDoc, req.user.id)),
  });
});

const createCall = asyncHandler(async (req, res) => {
  const receiverId = String(req.body.receiverId || "").trim();
  const type = String(req.body.type || "voice").trim();

  if (!mongoose.Types.ObjectId.isValid(receiverId)) {
    res.status(400);
    throw new Error("A valid receiverId is required.");
  }

  if (!["voice", "video"].includes(type)) {
    res.status(400);
    throw new Error("A valid call type is required.");
  }

  if (receiverId === req.user.id) {
    res.status(400);
    throw new Error("You cannot call yourself.");
  }

  const [caller, receiver] = await Promise.all([
    User.findById(req.user.id).select(
      "_id matchedContactIds blockedContacts privacy isBanned"
    ),
    User.findById(receiverId).select(
      "_id matchedContactIds blockedContacts privacy isBanned"
    ),
  ]);

  if (!receiver) {
    res.status(404);
    throw new Error("Receiver not found.");
  }

  const callPermission = canUserCall(caller || req.user, receiver);

  if (!callPermission.allowed) {
    res.status(403);
    throw new Error(callPermission.reason);
  }

  const call = await Call.create({
    callerId: req.user.id,
    receiverId,
    type,
    status: "ringing",
    roomId: crypto.randomUUID(),
  });

  const populatedCall = await Call.findById(call.id)
    .populate("callerId", "name phone profilePic about status lastSeen")
    .populate("receiverId", "name phone profilePic about status lastSeen");
  const serializedCall = serializeCall(populatedCall, req.user.id);
  const io = req.app.get("io");

  if (io) {
    io.to(getUserRoom(receiverId)).emit("incoming_call", serializedCall);
  }

  res.status(201).json({
    call: serializedCall,
  });
});

const updateCall = asyncHandler(async (req, res) => {
  const call = await Call.findById(req.params.callId)
    .populate("callerId", "name phone profilePic about status lastSeen")
    .populate("receiverId", "name phone profilePic about status lastSeen");

  if (!call) {
    res.status(404);
    throw new Error("Call not found.");
  }

  const nextStatus = String(req.body.status || "").trim();

  if (!["accepted", "rejected", "missed", "ended", "cancelled"].includes(nextStatus)) {
    res.status(400);
    throw new Error("A valid call status is required.");
  }

  const currentUserId = req.user.id;
  const isParticipant =
    call.callerId.id === currentUserId || call.receiverId.id === currentUserId;

  if (!isParticipant) {
    res.status(403);
    throw new Error("Only call participants can update a call.");
  }

  call.status = nextStatus;

  if (nextStatus === "accepted" && !call.startedAt) {
    call.startedAt = new Date();
  }

  if (["rejected", "missed", "ended", "cancelled"].includes(nextStatus)) {
    call.endedAt = new Date();
    if (call.startedAt) {
      call.durationSeconds = Math.max(
        0,
        Math.round((call.endedAt.getTime() - call.startedAt.getTime()) / 1000)
      );
    }
    call.endedBy = currentUserId;
  }

  await call.save();

  const refreshedCall = await Call.findById(call.id)
    .populate("callerId", "name phone profilePic about status lastSeen")
    .populate("receiverId", "name phone profilePic about status lastSeen");
  const serializedCall = serializeCall(refreshedCall, currentUserId);
  const io = req.app.get("io");

  if (io) {
    io.to(getUserRoom(refreshedCall.callerId.id)).emit("call_updated", serializedCall);
    io.to(getUserRoom(refreshedCall.receiverId.id)).emit("call_updated", serializedCall);
  }

  res.status(200).json({
    call: serializedCall,
  });
});

module.exports = {
  createCall,
  getCalls,
  updateCall,
};
