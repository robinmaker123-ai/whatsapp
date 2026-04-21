const assert = require("node:assert/strict");
const test = require("node:test");

process.env.ENABLE_DEV_OTP_PREVIEW = "true";
process.env.ALLOW_IN_MEMORY_MONGO = "true";

const { io } = require("socket.io-client");

const Message = require("../src/models/Message");
const { startServer } = require("../src/server");

const JSON_HEADERS = {
  "Content-Type": "application/json",
};

const waitForEvent = (emitter, eventName, predicate = () => true, timeout = 10000) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${eventName}`));
    }, timeout);

    const handler = (payload) => {
      try {
        if (!predicate(payload)) {
          return;
        }

        clearTimeout(timer);
        emitter.off(eventName, handler);
        resolve(payload);
      } catch (error) {
        clearTimeout(timer);
        emitter.off(eventName, handler);
        reject(error);
      }
    };

    emitter.on(eventName, handler);
  });

const emitWithAck = (socket, eventName, payload) =>
  new Promise((resolve) => {
    socket.emit(eventName, payload, resolve);
  });

const requestJson = async (baseUrl, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || `Request failed with ${response.status}`);
  }

  return data;
};

const createSession = async (baseUrl, name, phone) => {
  const sendOtpResponse = await requestJson(baseUrl, "/auth/send-otp", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({ phone }),
  });

  assert.ok(sendOtpResponse.mockOtp, "Expected mock OTP in development mode");

  return requestJson(baseUrl, "/auth/verify-otp", {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      phone,
      otp: sendOtpResponse.mockOtp,
      name,
    }),
  });
};

const connectUserSocket = async (baseUrl, token, userId) => {
  const socket = io(baseUrl, {
    auth: { token },
    reconnection: false,
    timeout: 10000,
  });

  await waitForEvent(socket, "connect");

  const joinAck = await emitWithAck(socket, "join_user", { userId });
  assert.equal(joinAck.ok, true, "join_user should succeed");

  return socket;
};

const createSocket = (baseUrl, token) =>
  io(baseUrl, {
    auth: { token },
    reconnection: false,
    timeout: 10000,
  });

test("real-time chat supports live delivery, typing, seen, and reconnect sync", async () => {
  const runtime = await startServer({
    port: 0,
    host: "127.0.0.1",
    enableSignalHandlers: false,
  });

  const baseUrl = `http://127.0.0.1:${runtime.port}`;
  let socketA = null;
  let socketB = null;

  try {
    const sessionA = await createSession(baseUrl, "User A", "+919111111111");
    const sessionB = await createSession(baseUrl, "User B", "+919222222222");

    const usersResponse = await requestJson(baseUrl, "/users", {
      headers: {
        Authorization: `Bearer ${sessionA.token}`,
      },
    });

    assert.ok(Array.isArray(usersResponse.users));
    assert.ok(usersResponse.users.length >= 1);

    socketA = await connectUserSocket(baseUrl, sessionA.token, sessionA.user.id);

    const userOnlinePromise = waitForEvent(
      socketA,
      "user_online",
      (payload) => payload.userId === sessionB.user.id
    );

    socketB = await connectUserSocket(baseUrl, sessionB.token, sessionB.user.id);
    const onlinePayload = await userOnlinePromise;
    assert.equal(onlinePayload.status, "online");

    const typingStartPromise = waitForEvent(
      socketB,
      "typing_start",
      (payload) =>
        payload.senderId === sessionA.user.id &&
        payload.receiverId === sessionB.user.id
    );
    const typingStartAck = await emitWithAck(socketA, "typing_start", {
      receiverId: sessionB.user.id,
    });
    assert.equal(typingStartAck.ok, true);
    await typingStartPromise;

    const typingStopPromise = waitForEvent(
      socketB,
      "typing_stop",
      (payload) =>
        payload.senderId === sessionA.user.id &&
        payload.receiverId === sessionB.user.id
    );
    const typingStopAck = await emitWithAck(socketA, "typing_stop", {
      receiverId: sessionB.user.id,
    });
    assert.equal(typingStopAck.ok, true);
    await typingStopPromise;

    const senderReceivePromise = waitForEvent(
      socketA,
      "receive_message",
      (payload) => payload.clientTempId === "temp-live-1"
    );
    const receiverReceivePromise = waitForEvent(
      socketB,
      "receive_message",
      (payload) => payload.clientTempId === "temp-live-1"
    );

    const sendMessageAck = await emitWithAck(socketA, "send_message", {
      receiverId: sessionB.user.id,
      text: "Hello from A",
      clientTempId: "temp-live-1",
    });

    assert.equal(sendMessageAck.ok, true);
    assert.equal(sendMessageAck.message.text, "Hello from A");
    assert.equal(sendMessageAck.message.status, "delivered");

    const [senderCopy, receiverCopy] = await Promise.all([
      senderReceivePromise,
      receiverReceivePromise,
    ]);

    assert.equal(senderCopy.id, receiverCopy.id);
    assert.equal(receiverCopy.text, "Hello from A");

    const seenPromise = waitForEvent(
      socketA,
      "message_seen",
      (payload) =>
        payload.messageId === senderCopy.id && payload.status === "seen"
    );

    const seenAck = await emitWithAck(socketB, "message_seen", {
      senderId: sessionA.user.id,
    });

    assert.equal(seenAck.ok, true);
    assert.ok(Array.isArray(seenAck.messages));
    const seenPayload = await seenPromise;
    assert.equal(seenPayload.status, "seen");

    const persistedMessage = await Message.findById(senderCopy.id);
    assert.ok(persistedMessage, "Expected message to be stored in MongoDB");
    assert.equal(persistedMessage.text, "Hello from A");
    assert.equal(persistedMessage.status, "seen");

    const restReceiverPromise = waitForEvent(
      socketB,
      "receive_message",
      (payload) => payload.clientTempId === "temp-rest-1"
    );

    const restSendResponse = await requestJson(baseUrl, "/messages/send", {
      method: "POST",
      headers: {
        ...JSON_HEADERS,
        Authorization: `Bearer ${sessionA.token}`,
      },
      body: JSON.stringify({
        receiverId: sessionB.user.id,
        text: "Hello via REST",
        clientTempId: "temp-rest-1",
      }),
    });

    assert.equal(restSendResponse.message.text, "Hello via REST");
    await restReceiverPromise;

    const offlinePromise = waitForEvent(
      socketA,
      "user_offline",
      (payload) => payload.userId === sessionB.user.id
    );
    socketB.disconnect();
    await offlinePromise;

    const offlineSenderReceive = waitForEvent(
      socketA,
      "receive_message",
      (payload) => payload.clientTempId === "temp-offline-2"
    );

    const offlineSendAck = await emitWithAck(socketA, "send_message", {
      receiverId: sessionB.user.id,
      text: "Message while B is offline",
      clientTempId: "temp-offline-2",
    });

    assert.equal(offlineSendAck.ok, true);
    assert.equal(offlineSendAck.message.status, "sent");

    const offlineSenderCopy = await offlineSenderReceive;
    assert.equal(offlineSenderCopy.status, "sent");

    const deliveredAfterReconnectPromise = waitForEvent(
      socketA,
      "message_seen",
      (payload) =>
        payload.messageId === offlineSenderCopy.id &&
        payload.status === "delivered"
    );

    socketB = createSocket(baseUrl, sessionB.token);
    const receiverOfflineCopyPromise = waitForEvent(
      socketB,
      "receive_message",
      (payload) => payload.id === offlineSenderCopy.id
    );
    await waitForEvent(socketB, "connect");
    const reconnectJoinAck = await emitWithAck(socketB, "join_user", {
      userId: sessionB.user.id,
    });
    assert.equal(reconnectJoinAck.ok, true);

    const receiverOfflineCopy = await receiverOfflineCopyPromise;
    assert.equal(receiverOfflineCopy.text, "Message while B is offline");

    const deliveredPayload = await deliveredAfterReconnectPromise;
    assert.equal(deliveredPayload.status, "delivered");
  } finally {
    socketA?.disconnect();
    socketB?.disconnect();
    await runtime.shutdown();
  }
});
