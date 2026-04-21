const normalizeMessageStatus = (status = "sent") =>
  status === "read" ? "seen" : status;

const stringifyId = (value) => {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value.toString === "function") {
    return value.toString();
  }

  return String(value);
};

const resolveText = (messageLike = {}, overrides = {}) =>
  String(overrides.text || messageLike.text || messageLike.message || "").trim();

const resolveCreatedAt = (messageLike = {}, overrides = {}) =>
  overrides.createdAt || messageLike.createdAt || messageLike.timestamp || null;

const serializeReplyMessage = (replyMessage) => {
  if (!replyMessage) {
    return null;
  }

  return {
    id: stringifyId(replyMessage.id || replyMessage._id),
    senderId: stringifyId(replyMessage.senderId),
    receiverId: stringifyId(replyMessage.receiverId),
    text: String(replyMessage.text || replyMessage.message || "").trim(),
    messageType: replyMessage.messageType || "text",
    mediaUrl: replyMessage.mediaUrl || "",
    createdAt:
      replyMessage.createdAt || replyMessage.timestamp || replyMessage.updatedAt || null,
  };
};

const serializeMessage = (messageLike = {}, overrides = {}) => ({
  id: stringifyId(overrides.id || messageLike.id || messageLike._id),
  clientTempId: overrides.clientTempId || messageLike.clientTempId || undefined,
  senderId: stringifyId(overrides.senderId || messageLike.senderId),
  receiverId: stringifyId(overrides.receiverId || messageLike.receiverId),
  text: resolveText(messageLike, overrides),
  messageType: overrides.messageType || messageLike.messageType || "text",
  mediaUrl: overrides.mediaUrl || messageLike.mediaUrl || "",
  mediaName: overrides.mediaName || messageLike.mediaName || "",
  mediaMimeType: overrides.mediaMimeType || messageLike.mediaMimeType || "",
  fileSize: overrides.fileSize ?? messageLike.fileSize ?? null,
  voiceNoteDuration:
    overrides.voiceNoteDuration ?? messageLike.voiceNoteDuration ?? null,
  replyToMessage:
    overrides.replyToMessage ?? serializeReplyMessage(messageLike.replyTo),
  forwardedFrom: stringifyId(
    overrides.forwardedFrom || messageLike.forwardedFrom || ""
  ),
  deletedForEveryone:
    overrides.deletedForEveryone ?? messageLike.deletedForEveryone ?? false,
  deletedFor: (overrides.deletedFor || messageLike.deletedFor || []).map((value) =>
    stringifyId(value)
  ),
  createdAt: resolveCreatedAt(messageLike, overrides),
  status: normalizeMessageStatus(overrides.status || messageLike.status || "sent"),
  deliveredAt: overrides.deliveredAt || messageLike.deliveredAt || null,
  seenAt: overrides.seenAt || messageLike.seenAt || messageLike.readAt || null,
});

const serializeMessageStatus = (messageLike = {}, overrides = {}) => ({
  messageId: stringifyId(
    overrides.messageId || messageLike.id || messageLike._id
  ),
  senderId: stringifyId(overrides.senderId || messageLike.senderId),
  receiverId: stringifyId(overrides.receiverId || messageLike.receiverId),
  status: normalizeMessageStatus(overrides.status || messageLike.status || "sent"),
  deliveredAt: overrides.deliveredAt || messageLike.deliveredAt || null,
  seenAt: overrides.seenAt || messageLike.seenAt || messageLike.readAt || null,
  createdAt: resolveCreatedAt(messageLike, overrides),
});

module.exports = {
  normalizeMessageStatus,
  serializeMessage,
  serializeMessageStatus,
};
