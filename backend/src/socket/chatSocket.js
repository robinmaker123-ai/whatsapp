const mongoose = require("mongoose");
const { Server } = require("socket.io");

const config = require("../config/env");
const Message = require("../models/Message");
const UserSession = require("../models/UserSession");
const User = require("../models/User");
const { verifyAccessToken } = require("../utils/authTokens");
const {
  serializeMessage,
  serializeMessageStatus,
} = require("../utils/messagePayloads");
const { sendMessageWithDispatch } = require("../utils/messageService");

const userConnections = new Map();

const getUserRoom = (userId) => `user:${userId}`;

const addUserConnection = (userId, socketId) => {
  const sockets = userConnections.get(userId) || new Set();
  sockets.add(socketId);
  userConnections.set(userId, sockets);
  return sockets.size;
};

const removeUserConnection = (userId, socketId) => {
  const sockets = userConnections.get(userId);

  if (!sockets) {
    return 0;
  }

  sockets.delete(socketId);

  if (sockets.size === 0) {
    userConnections.delete(userId);
    return 0;
  }

  userConnections.set(userId, sockets);
  return sockets.size;
};

const parseToken = (value = "") => {
  const rawValue = String(value).trim();

  if (rawValue.startsWith("Bearer ")) {
    return rawValue.slice(7).trim();
  }

  return rawValue;
};

const createSocketError = (message) => {
  const error = new Error(message);
  error.data = { message };
  return error;
};

const emitAck = (ack, payload) => {
  if (typeof ack === "function") {
    ack(payload);
  }
};

const toPresencePayload = (userDoc) => ({
  userId: userDoc.id,
  status: userDoc.status,
  lastSeen: userDoc.lastSeen,
});

const emitPresenceUpdate = (io, eventName, userDoc) => {
  io.emit(eventName, toPresencePayload(userDoc));
};

const emitMessageStatusUpdate = (io, payload) => {
  io.to(getUserRoom(payload.senderId)).emit("message_seen", payload);
  io.to(getUserRoom(payload.receiverId)).emit("message_seen", payload);
};

const relayToReceiver = (io, eventName, receiverId, payload) => {
  io.to(getUserRoom(receiverId)).emit(eventName, payload);
};

const authenticateSocket = async (socket, next) => {
  try {
    const authToken = parseToken(socket.handshake.auth?.token);
    const headerToken = parseToken(socket.handshake.headers.authorization);
    const token = authToken || headerToken;

    if (!token) {
      return next(createSocketError("Authentication token is required."));
    }

    const decoded = verifyAccessToken(token);
    const [user, sessionDoc] = await Promise.all([
      User.findById(decoded.userId),
      decoded.sessionId ? UserSession.findById(decoded.sessionId) : Promise.resolve(null),
    ]);

    if (!user) {
      return next(createSocketError("User not found."));
    }

    if (user.isBanned) {
      return next(createSocketError(user.banReason || "Your account is suspended."));
    }

    if (!sessionDoc || sessionDoc.isRevoked || sessionDoc.userId.toString() !== user.id) {
      return next(createSocketError("Session expired. Please sign in again."));
    }

    if (sessionDoc.expiresAt.getTime() <= Date.now()) {
      sessionDoc.isRevoked = true;
      sessionDoc.revokedAt = new Date();
      await sessionDoc.save();
      return next(createSocketError("Session expired. Please sign in again."));
    }

    sessionDoc.lastUsedAt = new Date();
    await sessionDoc.save();

    socket.user = user;
    socket.authSession = sessionDoc;
    return next();
  } catch (error) {
    return next(createSocketError("Socket authentication failed."));
  }
};

const syncPendingMessages = async (userId, io) => {
  const pendingMessages = await Message.find({
    receiverId: userId,
    status: "sent",
  }).sort({ createdAt: 1, timestamp: 1 });

  if (pendingMessages.length === 0) {
    return;
  }

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

  pendingMessages.forEach((messageDoc) => {
    messageDoc.status = "delivered";
    messageDoc.deliveredAt = deliveredAt;

    emitMessageStatusUpdate(io, serializeMessageStatus(messageDoc));
    io.to(getUserRoom(userId)).emit("receive_message", serializeMessage(messageDoc));
  });
};

const joinAuthenticatedUser = async (socket, io, ack) => {
  const currentUserId = socket.user.id;

  if (!socket.data.hasJoinedUserRoom) {
    socket.join(getUserRoom(currentUserId));
    socket.data.hasJoinedUserRoom = true;

    const connectionCount = addUserConnection(currentUserId, socket.id);

    if (connectionCount === 1) {
      const userDoc = await User.findByIdAndUpdate(
        currentUserId,
        {
          status: "online",
          lastSeen: null,
        },
        { new: true }
      );

      if (userDoc) {
        emitPresenceUpdate(io, "user_online", userDoc);
      }
    }
  }

  await syncPendingMessages(currentUserId, io);

  emitAck(ack, {
    ok: true,
    userId: currentUserId,
    socketId: socket.id,
  });
};

const initializeSocketServer = (server) => {
  const allowAnyOrigin =
    config.corsOrigins.length === 0 || config.corsOrigins.includes("*");
  const io = new Server(server, {
    cors: {
      origin: allowAnyOrigin ? true : config.corsOrigins,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    },
  });

  io.getActiveUserCount = () => userConnections.size;
  io.getActiveConnectionCount = () =>
    Array.from(userConnections.values()).reduce(
      (totalConnections, socketIds) => totalConnections + socketIds.size,
      0
    );
  io.disconnectUserConnections = (userId) => {
    const sockets = userConnections.get(String(userId));

    if (!sockets) {
      return 0;
    }

    sockets.forEach((socketId) => {
      io.sockets.sockets.get(socketId)?.disconnect(true);
    });

    return sockets.size;
  };

  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    const currentUserId = socket.user.id;
    const ensureJoinedUser = async () => {
      if (!socket.data.hasJoinedUserRoom) {
        await joinAuthenticatedUser(socket, io);
      }
    };

    socket.on("join_user", async (payload = {}, ack) => {
      try {
        const requestedUserId = String(payload.userId || "").trim();

        if (requestedUserId && requestedUserId !== currentUserId) {
          throw new Error("join_user can only be used for the authenticated user.");
        }

        await joinAuthenticatedUser(socket, io, ack);
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("send_message", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();
        const { message } = await sendMessageWithDispatch(
          {
            ...payload,
            senderId: currentUserId,
            text: payload.text ?? payload.message,
          },
          io
        );

        emitAck(ack, {
          ok: true,
          message,
        });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("typing_start", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();

        const receiverId = String(payload.receiverId || "").trim();

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error("A valid receiverId is required.");
        }

        relayToReceiver(io, "typing_start", receiverId, {
          senderId: currentUserId,
          receiverId,
        });

        emitAck(ack, { ok: true });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("typing_stop", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();

        const receiverId = String(payload.receiverId || "").trim();

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error("A valid receiverId is required.");
        }

        relayToReceiver(io, "typing_stop", receiverId, {
          senderId: currentUserId,
          receiverId,
        });

        emitAck(ack, { ok: true });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("message_seen", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();

        const messageId = String(payload.messageId || "").trim();
        const senderId = String(payload.senderId || "").trim();

        let messagesToMark = [];

        if (messageId) {
          if (!mongoose.Types.ObjectId.isValid(messageId)) {
            throw new Error("A valid messageId is required.");
          }

          const messageDoc = await Message.findById(messageId);

          if (!messageDoc) {
            throw new Error("Message not found.");
          }

          if (messageDoc.receiverId.toString() !== currentUserId) {
            throw new Error("You can only mark your own received messages as seen.");
          }

          if (messageDoc.status !== "seen" && messageDoc.status !== "read") {
            messagesToMark = [messageDoc];
          }
        } else if (senderId) {
          if (!mongoose.Types.ObjectId.isValid(senderId)) {
            throw new Error("A valid senderId is required.");
          }

          messagesToMark = await Message.find({
            senderId,
            receiverId: currentUserId,
            status: {
              $in: ["sent", "delivered"],
            },
          });
        } else {
          throw new Error("messageId or senderId is required.");
        }

        if (messagesToMark.length === 0) {
          emitAck(ack, {
            ok: true,
            messages: [],
          });
          return;
        }

        const seenAt = new Date();

        await Promise.all(
          messagesToMark.map((messageDoc) =>
            Message.updateOne(
              { _id: messageDoc._id },
              {
                $set: {
                  status: "seen",
                  deliveredAt: messageDoc.deliveredAt || seenAt,
                  seenAt,
                  readAt: seenAt,
                },
              }
            )
          )
        );

        const statusPayloads = messagesToMark.map((messageDoc) => {
          messageDoc.status = "seen";
          messageDoc.deliveredAt = messageDoc.deliveredAt || seenAt;
          messageDoc.seenAt = seenAt;
          messageDoc.readAt = seenAt;

          return serializeMessageStatus(messageDoc);
        });

        statusPayloads.forEach((statusPayload) => {
          emitMessageStatusUpdate(io, statusPayload);
        });

        emitAck(ack, {
          ok: true,
          messages: statusPayloads,
        });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("call_offer", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();
        const receiverId = String(payload.receiverId || "").trim();

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error("A valid receiverId is required.");
        }

        relayToReceiver(io, "call_offer", receiverId, {
          callId: payload.callId,
          roomId: payload.roomId,
          callerId: currentUserId,
          receiverId,
          type: payload.type || "voice",
          offer: payload.offer || null,
        });

        emitAck(ack, { ok: true });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("call_answer", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();
        const receiverId = String(payload.receiverId || "").trim();

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error("A valid receiverId is required.");
        }

        relayToReceiver(io, "call_answer", receiverId, {
          callId: payload.callId,
          roomId: payload.roomId,
          callerId: currentUserId,
          receiverId,
          answer: payload.answer || null,
        });

        emitAck(ack, { ok: true });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("call_ice_candidate", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();
        const receiverId = String(payload.receiverId || "").trim();

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error("A valid receiverId is required.");
        }

        relayToReceiver(io, "call_ice_candidate", receiverId, {
          callId: payload.callId,
          roomId: payload.roomId,
          senderId: currentUserId,
          receiverId,
          candidate: payload.candidate || null,
        });

        emitAck(ack, { ok: true });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("call_control", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();
        const receiverId = String(payload.receiverId || "").trim();

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error("A valid receiverId is required.");
        }

        relayToReceiver(io, "call_control", receiverId, {
          callId: payload.callId,
          roomId: payload.roomId,
          senderId: currentUserId,
          receiverId,
          control: payload.control || null,
        });

        emitAck(ack, { ok: true });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("call_end", async (payload = {}, ack) => {
      try {
        await ensureJoinedUser();
        const receiverId = String(payload.receiverId || "").trim();

        if (!mongoose.Types.ObjectId.isValid(receiverId)) {
          throw new Error("A valid receiverId is required.");
        }

        relayToReceiver(io, "call_end", receiverId, {
          callId: payload.callId,
          roomId: payload.roomId,
          senderId: currentUserId,
          receiverId,
        });

        emitAck(ack, { ok: true });
      } catch (error) {
        emitAck(ack, {
          ok: false,
          error: error.message,
        });
      }
    });

    socket.on("disconnect", async () => {
      const remainingConnections = removeUserConnection(currentUserId, socket.id);

      if (remainingConnections === 0) {
        try {
          const userDoc = await User.findByIdAndUpdate(
            currentUserId,
            {
              status: "offline",
              lastSeen: new Date(),
            },
            { new: true }
          );

          if (userDoc) {
            emitPresenceUpdate(io, "user_offline", userDoc);
          }
        } catch (error) {
          console.error("Socket disconnect cleanup failed:", error.message);
        }
      }
    });
  });

  return io;
};

module.exports = initializeSocketServer;
