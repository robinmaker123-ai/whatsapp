const mongoose = require("mongoose");

const Message = require("../models/Message");
const User = require("../models/User");
const { serializeMessage, serializeMessageStatus } = require("../utils/messagePayloads");
const asyncHandler = require("../utils/asyncHandler");
const { sendMessageWithDispatch } = require("../utils/messageService");

const getUserRoom = (userId) => `user:${userId}`;

const emitDeliveredStatusUpdates = (io, messages, deliveredAt) => {
  if (!io || messages.length === 0) {
    return;
  }

  messages.forEach((messageDoc) => {
    const statusPayload = serializeMessageStatus(messageDoc, {
      status: "delivered",
      deliveredAt,
      seenAt: null,
    });

    io.to(getUserRoom(statusPayload.senderId)).emit("message_seen", statusPayload);
    io.to(getUserRoom(statusPayload.receiverId)).emit("message_seen", statusPayload);
  });
};

const getConversation = asyncHandler(async (req, res) => {
  const currentUserId = req.user.id;
  const otherUserId = String(req.params.userId || "").trim();

  if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
    res.status(400);
    throw new Error("A valid user id is required.");
  }

  const otherUser = await User.findById(otherUserId).select("_id");

  if (!otherUser) {
    res.status(404);
    throw new Error("Chat user not found.");
  }

  const pendingMessages = await Message.find({
    senderId: otherUserId,
    receiverId: currentUserId,
    status: "sent",
  }).select("_id senderId receiverId createdAt timestamp status deliveredAt seenAt");

  if (pendingMessages.length > 0) {
    const deliveredAt = new Date();

    await Message.updateMany(
      {
        _id: {
          $in: pendingMessages.map((messageDoc) => messageDoc._id),
        },
      },
      {
        $set: {
          status: "delivered",
          deliveredAt,
        },
      }
    );

    emitDeliveredStatusUpdates(req.app.get("io"), pendingMessages, deliveredAt);
  }

  const messages = await Message.find({
    $or: [
      { senderId: currentUserId, receiverId: otherUserId },
      { senderId: otherUserId, receiverId: currentUserId },
    ],
    deletedFor: {
      $ne: currentUserId,
    },
  })
    .populate("replyTo")
    .sort({ createdAt: 1, timestamp: 1 });

  res.status(200).json({
    messages: messages.map((messageDoc) => serializeMessage(messageDoc)),
  });
});

const sendMessage = asyncHandler(async (req, res) => {
  const io = req.app.get("io");
  const payload = {
    senderId: req.user.id,
    receiverId: req.body.receiverId,
    text: req.body.text ?? req.body.message,
    messageType: req.body.messageType,
    mediaUrl: req.body.mediaUrl,
    mediaName: req.body.mediaName,
    mediaMimeType: req.body.mediaMimeType,
    fileSize: req.body.fileSize,
    voiceNoteDuration: req.body.voiceNoteDuration,
    replyToMessageId: req.body.replyToMessageId,
    forwardedFrom: req.body.forwardedFrom,
    clientTempId: req.body.clientTempId,
  };

  const { message } = await sendMessageWithDispatch(payload, io);

  res.status(201).json({
    message,
  });
});

const deleteMessage = asyncHandler(async (req, res) => {
  const message = await Message.findById(req.params.messageId);

  if (!message) {
    res.status(404);
    throw new Error("Message not found.");
  }

  const deleteMode = String(req.body.deleteMode || "for_me").trim();
  const currentUserId = req.user.id;
  const isSender = message.senderId.toString() === currentUserId;
  const isReceiver = message.receiverId.toString() === currentUserId;

  if (!isSender && !isReceiver) {
    res.status(403);
    throw new Error("You can only delete messages from your own conversation.");
  }

  if (deleteMode === "for_everyone") {
    if (!isSender) {
      res.status(403);
      throw new Error("Only the sender can delete for everyone.");
    }

    message.deletedForEveryone = true;
    message.text = "This message was deleted";
    message.message = "This message was deleted";
    message.mediaUrl = "";
    message.mediaName = "";
    message.mediaMimeType = "";
    message.fileSize = null;
    message.voiceNoteDuration = null;
  } else {
    const deletedFor = new Set((message.deletedFor || []).map((value) => value.toString()));
    deletedFor.add(currentUserId);
    message.deletedFor = Array.from(deletedFor);
  }

  await message.save();

  const io = req.app.get("io");
  const serializedMessage = serializeMessage(message);

  if (io) {
    io.to(getUserRoom(message.senderId.toString())).emit(
      "message_updated",
      serializedMessage
    );
    io.to(getUserRoom(message.receiverId.toString())).emit(
      "message_updated",
      serializedMessage
    );
  }

  res.status(200).json({
    message: serializedMessage,
  });
});

const forwardMessage = asyncHandler(async (req, res) => {
  const originalMessage = await Message.findById(req.params.messageId).populate("replyTo");

  if (!originalMessage) {
    res.status(404);
    throw new Error("Message not found.");
  }

  const receiverId = String(req.body.receiverId || "").trim();

  const { message } = await sendMessageWithDispatch(
    {
      senderId: req.user.id,
      receiverId,
      text: originalMessage.text,
      messageType: originalMessage.messageType,
      mediaUrl: originalMessage.mediaUrl,
      mediaName: originalMessage.mediaName,
      mediaMimeType: originalMessage.mediaMimeType,
      fileSize: originalMessage.fileSize,
      voiceNoteDuration: originalMessage.voiceNoteDuration,
      forwardedFrom: originalMessage.senderId.toString(),
      clientTempId: req.body.clientTempId,
    },
    req.app.get("io")
  );

  res.status(201).json({
    message,
  });
});

module.exports = {
  deleteMessage,
  forwardMessage,
  getConversation,
  sendMessage,
};
