import { io, type Socket } from "socket.io-client";

import { IS_NETWORK_CONFIGURED, SOCKET_URL } from "../config/env";
import type {
  CallRecord,
  CallSignalPayload,
  JoinUserAck,
  Message,
  MessageSeenAck,
  MessageSeenPayload,
  SendMessageAck,
  SendMessagePayload,
  SocketAck,
  StatusItem,
  TypingPayload,
  UserPresencePayload,
} from "../types/models";

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private userId: string | null = null;
  private receiveMessageListeners = new Set<(message: Message) => void>();
  private messageSeenListeners = new Set<(payload: MessageSeenPayload) => void>();
  private messageUpdatedListeners = new Set<(message: Message) => void>();
  private userOnlineListeners = new Set<(payload: UserPresencePayload) => void>();
  private userOfflineListeners = new Set<(payload: UserPresencePayload) => void>();
  private typingStartListeners = new Set<(payload: TypingPayload) => void>();
  private typingStopListeners = new Set<(payload: TypingPayload) => void>();
  private incomingCallListeners = new Set<(call: CallRecord) => void>();
  private callUpdatedListeners = new Set<(call: CallRecord) => void>();
  private callOfferListeners = new Set<(payload: CallSignalPayload) => void>();
  private callAnswerListeners = new Set<(payload: CallSignalPayload) => void>();
  private callIceCandidateListeners = new Set<(payload: CallSignalPayload) => void>();
  private callControlListeners = new Set<(payload: CallSignalPayload) => void>();
  private callEndListeners = new Set<(payload: CallSignalPayload) => void>();
  private statusCreatedListeners = new Set<(status: StatusItem) => void>();

  private bindStoredListeners() {
    if (!this.socket) {
      return;
    }

    this.receiveMessageListeners.forEach((listener) => {
      this.socket?.on("receive_message", listener);
    });
    this.messageSeenListeners.forEach((listener) => {
      this.socket?.on("message_seen", listener);
    });
    this.messageUpdatedListeners.forEach((listener) => {
      this.socket?.on("message_updated", listener);
    });
    this.userOnlineListeners.forEach((listener) => {
      this.socket?.on("user_online", listener);
    });
    this.userOfflineListeners.forEach((listener) => {
      this.socket?.on("user_offline", listener);
    });
    this.typingStartListeners.forEach((listener) => {
      this.socket?.on("typing_start", listener);
    });
    this.typingStopListeners.forEach((listener) => {
      this.socket?.on("typing_stop", listener);
    });
    this.incomingCallListeners.forEach((listener) => {
      this.socket?.on("incoming_call", listener);
    });
    this.callUpdatedListeners.forEach((listener) => {
      this.socket?.on("call_updated", listener);
    });
    this.callOfferListeners.forEach((listener) => {
      this.socket?.on("call_offer", listener);
    });
    this.callAnswerListeners.forEach((listener) => {
      this.socket?.on("call_answer", listener);
    });
    this.callIceCandidateListeners.forEach((listener) => {
      this.socket?.on("call_ice_candidate", listener);
    });
    this.callControlListeners.forEach((listener) => {
      this.socket?.on("call_control", listener);
    });
    this.callEndListeners.forEach((listener) => {
      this.socket?.on("call_end", listener);
    });
    this.statusCreatedListeners.forEach((listener) => {
      this.socket?.on("status_created", listener);
    });
  }

  connect(token: string, userId: string) {
    if (!IS_NETWORK_CONFIGURED) {
      return null;
    }

    const shouldReuseSocket =
      this.socket &&
      this.token === token &&
      this.userId === userId &&
      this.socket.active;

    if (shouldReuseSocket) {
      const activeSocket = this.socket;

      if (!activeSocket) {
        throw new Error("Socket instance is unavailable.");
      }

      if (!activeSocket.connected) {
        activeSocket.connect();
      } else {
        void this.joinUser();
      }

      return activeSocket;
    }

    this.disconnect();

    this.token = token;
    this.userId = userId;

    this.socket = io(SOCKET_URL, {
      autoConnect: true,
      auth: {
        token,
      },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    this.bindStoredListeners();

    this.socket.on("connect", () => {
      void this.joinUser();
    });

    return this.socket;
  }

  isConnected() {
    return Boolean(this.socket?.connected);
  }

  disconnect() {
    if (!this.socket) {
      return;
    }

    this.socket.removeAllListeners();
    this.socket.disconnect();
    this.socket = null;
    this.token = null;
    this.userId = null;
  }

  private emitWithAck<T>(eventName: string, payload?: unknown) {
    return new Promise<T & { ok: boolean; error?: string }>((resolve) => {
      if (!IS_NETWORK_CONFIGURED || !this.socket?.connected) {
        resolve({
          ok: false,
          error: "Socket is not connected.",
        } as T & { ok: boolean; error?: string });
        return;
      }

      this.socket.emit(eventName, payload, resolve);
    });
  }

  joinUser() {
    if (!this.userId) {
      return Promise.resolve<JoinUserAck>({
        ok: false,
        error: "User id is not available.",
      });
    }

    return this.emitWithAck<JoinUserAck>("join_user", {
      userId: this.userId,
    });
  }

  private onStoredEvent<T>(
    store: Set<(payload: T) => void>,
    eventName: string,
    listener: (payload: T) => void
  ) {
    store.add(listener);
    this.socket?.on(eventName, listener);
  }

  private offStoredEvent<T>(
    store: Set<(payload: T) => void>,
    eventName: string,
    listener: (payload: T) => void
  ) {
    store.delete(listener);
    this.socket?.off(eventName, listener);
  }

  onReceiveMessage(listener: (message: Message) => void) {
    this.onStoredEvent(this.receiveMessageListeners, "receive_message", listener);
  }

  offReceiveMessage(listener: (message: Message) => void) {
    this.offStoredEvent(this.receiveMessageListeners, "receive_message", listener);
  }

  onMessageSeen(listener: (payload: MessageSeenPayload) => void) {
    this.onStoredEvent(this.messageSeenListeners, "message_seen", listener);
  }

  offMessageSeen(listener: (payload: MessageSeenPayload) => void) {
    this.offStoredEvent(this.messageSeenListeners, "message_seen", listener);
  }

  onMessageUpdated(listener: (message: Message) => void) {
    this.onStoredEvent(this.messageUpdatedListeners, "message_updated", listener);
  }

  offMessageUpdated(listener: (message: Message) => void) {
    this.offStoredEvent(this.messageUpdatedListeners, "message_updated", listener);
  }

  onUserOnline(listener: (payload: UserPresencePayload) => void) {
    this.onStoredEvent(this.userOnlineListeners, "user_online", listener);
  }

  offUserOnline(listener: (payload: UserPresencePayload) => void) {
    this.offStoredEvent(this.userOnlineListeners, "user_online", listener);
  }

  onUserOffline(listener: (payload: UserPresencePayload) => void) {
    this.onStoredEvent(this.userOfflineListeners, "user_offline", listener);
  }

  offUserOffline(listener: (payload: UserPresencePayload) => void) {
    this.offStoredEvent(this.userOfflineListeners, "user_offline", listener);
  }

  onTypingStart(listener: (payload: TypingPayload) => void) {
    this.onStoredEvent(this.typingStartListeners, "typing_start", listener);
  }

  offTypingStart(listener: (payload: TypingPayload) => void) {
    this.offStoredEvent(this.typingStartListeners, "typing_start", listener);
  }

  onTypingStop(listener: (payload: TypingPayload) => void) {
    this.onStoredEvent(this.typingStopListeners, "typing_stop", listener);
  }

  offTypingStop(listener: (payload: TypingPayload) => void) {
    this.offStoredEvent(this.typingStopListeners, "typing_stop", listener);
  }

  onIncomingCall(listener: (call: CallRecord) => void) {
    this.onStoredEvent(this.incomingCallListeners, "incoming_call", listener);
  }

  offIncomingCall(listener: (call: CallRecord) => void) {
    this.offStoredEvent(this.incomingCallListeners, "incoming_call", listener);
  }

  onCallUpdated(listener: (call: CallRecord) => void) {
    this.onStoredEvent(this.callUpdatedListeners, "call_updated", listener);
  }

  offCallUpdated(listener: (call: CallRecord) => void) {
    this.offStoredEvent(this.callUpdatedListeners, "call_updated", listener);
  }

  onCallOffer(listener: (payload: CallSignalPayload) => void) {
    this.onStoredEvent(this.callOfferListeners, "call_offer", listener);
  }

  offCallOffer(listener: (payload: CallSignalPayload) => void) {
    this.offStoredEvent(this.callOfferListeners, "call_offer", listener);
  }

  onCallAnswer(listener: (payload: CallSignalPayload) => void) {
    this.onStoredEvent(this.callAnswerListeners, "call_answer", listener);
  }

  offCallAnswer(listener: (payload: CallSignalPayload) => void) {
    this.offStoredEvent(this.callAnswerListeners, "call_answer", listener);
  }

  onCallIceCandidate(listener: (payload: CallSignalPayload) => void) {
    this.onStoredEvent(this.callIceCandidateListeners, "call_ice_candidate", listener);
  }

  offCallIceCandidate(listener: (payload: CallSignalPayload) => void) {
    this.offStoredEvent(
      this.callIceCandidateListeners,
      "call_ice_candidate",
      listener
    );
  }

  onCallControl(listener: (payload: CallSignalPayload) => void) {
    this.onStoredEvent(this.callControlListeners, "call_control", listener);
  }

  offCallControl(listener: (payload: CallSignalPayload) => void) {
    this.offStoredEvent(this.callControlListeners, "call_control", listener);
  }

  onCallEnd(listener: (payload: CallSignalPayload) => void) {
    this.onStoredEvent(this.callEndListeners, "call_end", listener);
  }

  offCallEnd(listener: (payload: CallSignalPayload) => void) {
    this.offStoredEvent(this.callEndListeners, "call_end", listener);
  }

  onStatusCreated(listener: (status: StatusItem) => void) {
    this.onStoredEvent(this.statusCreatedListeners, "status_created", listener);
  }

  offStatusCreated(listener: (status: StatusItem) => void) {
    this.offStoredEvent(this.statusCreatedListeners, "status_created", listener);
  }

  sendMessage(payload: SendMessagePayload) {
    return this.emitWithAck<SendMessageAck>("send_message", payload);
  }

  markMessagesSeen(senderId: string) {
    return this.emitWithAck<MessageSeenAck>("message_seen", { senderId });
  }

  emitTypingStart(receiverId: string) {
    return this.emitWithAck<SocketAck>("typing_start", { receiverId });
  }

  emitTypingStop(receiverId: string) {
    return this.emitWithAck<SocketAck>("typing_stop", { receiverId });
  }

  sendCallOffer(payload: CallSignalPayload) {
    return this.emitWithAck<SocketAck>("call_offer", payload);
  }

  sendCallAnswer(payload: CallSignalPayload) {
    return this.emitWithAck<SocketAck>("call_answer", payload);
  }

  sendIceCandidate(payload: CallSignalPayload) {
    return this.emitWithAck<SocketAck>("call_ice_candidate", payload);
  }

  sendCallControl(payload: CallSignalPayload) {
    return this.emitWithAck<SocketAck>("call_control", payload);
  }

  endCall(payload: CallSignalPayload) {
    return this.emitWithAck<SocketAck>("call_end", payload);
  }
}

export const socketService = new SocketService();
