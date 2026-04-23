const DUPLICATE_WINDOW_MS = 45 * 1000;
const DUPLICATE_LIMIT = 4;
const MESSAGE_BURST_WINDOW_MS = 60 * 1000;
const MESSAGE_BURST_LIMIT = 35;

const canUsersInteract = (sender, receiver) => {
  const senderId = sender.id || sender._id?.toString();
  const receiverId = receiver.id || receiver._id?.toString();
  const senderBlockedContacts = new Set((sender.blockedContacts || []).map((value) => value.toString()));
  const receiverBlockedContacts = new Set((receiver.blockedContacts || []).map((value) => value.toString()));

  if (senderBlockedContacts.has(receiverId)) {
    return {
      allowed: false,
      reason: "Unblock this user before sending new messages.",
    };
  }

  if (receiverBlockedContacts.has(senderId)) {
    return {
      allowed: false,
      reason: "This user is not accepting messages from you.",
    };
  }

  if (receiver.isBanned) {
    return {
      allowed: false,
      reason: "The target account is unavailable.",
    };
  }

  return {
    allowed: true,
    reason: "",
  };
};

const canUserCall = (caller, receiver) => {
  const baseRule = canUsersInteract(caller, receiver);

  if (!baseRule.allowed) {
    return baseRule;
  }

  if (receiver.privacy?.callVisibility === "nobody") {
    return {
      allowed: false,
      reason: "This user is not accepting calls right now.",
    };
  }

  if (receiver.privacy?.callVisibility === "contacts") {
    const matchedIds = new Set((receiver.matchedContactIds || []).map((value) => value.toString()));

    if (!matchedIds.has(caller.id || caller._id?.toString())) {
      return {
        allowed: false,
        reason: "This user only accepts calls from saved contacts.",
      };
    }
  }

  return {
    allowed: true,
    reason: "",
  };
};

const createMessageSpamRules = (MessageModel) => async ({ senderId, receiverId, text }) => {
  const normalizedText = String(text || "").trim();
  const now = Date.now();
  const duplicateSince = new Date(now - DUPLICATE_WINDOW_MS);
  const burstSince = new Date(now - MESSAGE_BURST_WINDOW_MS);

  const [duplicateCount, burstCount] = await Promise.all([
    normalizedText
      ? MessageModel.countDocuments({
          senderId,
          receiverId,
          text: normalizedText,
          createdAt: {
            $gte: duplicateSince,
          },
        })
      : Promise.resolve(0),
    MessageModel.countDocuments({
      senderId,
      createdAt: {
        $gte: burstSince,
      },
    }),
  ]);

  if (duplicateCount >= DUPLICATE_LIMIT) {
    throw new Error("Duplicate message protection triggered. Please slow down.");
  }

  if (burstCount >= MESSAGE_BURST_LIMIT) {
    throw new Error("Too many messages sent in a short time. Please wait and try again.");
  }
};

module.exports = {
  canUserCall,
  canUsersInteract,
  createMessageSpamRules,
};
