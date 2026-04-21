const mongoose = require("mongoose");

const Message = require("../models/Message");
const User = require("../models/User");
const { serializeMessage } = require("./messagePayloads");

const getUserRoom = (userId) => `user:${userId}`;

const isRoomOccupied = (io, userId) => {
  if (!io) {
    return false;
  }

  const room = io.sockets.adapter.rooms.get(getUserRoom(userId));

  return Boolean(room && room.size > 0);
};

const dispatchMessage = (io, messageDoc, clientTempId) => {
  const serializedMessage = serializeMessage(messageDoc, {
    clientTempId: clientTempId || undefined,
  });

  if (io) {
    io.to(getUserRoom(serializedMessage.senderId)).emit(
      "receive_message",
      serializedMessage
    );
    io.to(getUserRoom(serializedMessage.receiverId)).emit(
      "receive_message",
      serializedMessage
    );
  }

  return serializedMessage;
};

const sendMessageWithDispatch = async (payload = {}, io) => {
  const senderId = String(payload.senderId || "").trim();
  const receiverId = String(payload.receiverId || "").trim();
  const text = String(payload.text || payload.message || "").trim();
  const messageType = String(payload.messageType || "text").trim();
  const mediaUrl = String(payload.mediaUrl || "").trim();
  const mediaName = String(payload.mediaName || "").trim();
  const mediaMimeType = String(payload.mediaMimeType || "").trim();
  const clientTempId = String(payload.clientTempId || "").trim();
  const replyToMessageId = String(payload.replyToMessageId || "").trim();
  const forwardedFrom = String(payload.forwardedFrom || "").trim();
  const fileSize =
    payload.fileSize === undefined || payload.fileSize === null
      ? null
      : Number(payload.fileSize);
  const voiceNoteDuration =
    payload.voiceNoteDuration === undefined || payload.voiceNoteDuration === null
      ? null
      : Number(payload.voiceNoteDuration);

  if (!mongoose.Types.ObjectId.isValid(senderId)) {
    throw new Error("A valid senderId is required.");
  }

  if (!mongoose.Types.ObjectId.isValid(receiverId)) {
    throw new Error("A valid receiverId is required.");
  }

  if (senderId === receiverId) {
    throw new Error("You cannot send messages to yourself.");
  }

  if (!["text", "image", "video", "audio", "file"].includes(messageType)) {
    throw new Error("A valid messageType is required.");
  }

  if (!text && !mediaUrl) {
    throw new Error("Message text or media is required.");
  }

  const receiver = await User.findById(receiverId).select("_id");

  if (!receiver) {
    throw new Error("Receiver not found.");
  }

  let replyMessage = null;

  if (replyToMessageId) {
    if (!mongoose.Types.ObjectId.isValid(replyToMessageId)) {
      throw new Error("A valid replyToMessageId is required.");
    }

    replyMessage = await Message.findById(replyToMessageId).select(
      "_id senderId receiverId text message messageType mediaUrl createdAt timestamp"
    );

    if (!replyMessage) {
      throw new Error("Reply target not found.");
    }
  }

  const receiverIsOnline = isRoomOccupied(io, receiverId);
  const deliveredAt = receiverIsOnline ? new Date() : null;

  let messageDoc = await Message.create({
    senderId,
    receiverId,
    text,
    message: text,
    messageType,
    mediaUrl,
    mediaName,
    mediaMimeType,
    fileSize,
    voiceNoteDuration,
    replyTo: replyMessage ? replyMessage._id : null,
    forwardedFrom:
      forwardedFrom && mongoose.Types.ObjectId.isValid(forwardedFrom)
        ? forwardedFrom
        : null,
    status: receiverIsOnline ? "delivered" : "sent",
    deliveredAt,
    timestamp: deliveredAt || new Date(),
  });

  messageDoc = await messageDoc.populate("replyTo");

  const message = dispatchMessage(io, messageDoc, clientTempId);

  return {
    message,
    messageDoc,
  };
};

module.exports = {
  getUserRoom,
  isRoomOccupied,
  sendMessageWithDispatch,
};
