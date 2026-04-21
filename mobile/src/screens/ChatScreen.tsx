import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../components/Avatar";
import { ChatInput } from "../components/ChatInput";
import { MessageBubble } from "../components/MessageBubble";
import { TypingIndicator } from "../components/TypingIndicator";
import { useAuth } from "../contexts/AuthContext";
import {
  cacheConversation,
  loadCachedConversation,
} from "../services/cacheStorage";
import {
  createCallRequest,
  deleteMessageRequest,
  extractApiError,
  fetchConversation,
  fetchUsers,
  forwardMessageRequest,
  sendMessageRequest,
  uploadMedia,
} from "../services/api";
import { socketService } from "../services/socketService";
import { radii, shadows, spacing, useAppTheme } from "../theme";
import type {
  Message,
  PendingMedia,
  ReplyPreview,
  SendMessagePayload,
  User,
  UserPresencePayload,
} from "../types/models";
import type { ChatScreenProps } from "../types/navigation";
import { formatPresenceText } from "../utils/format";
import { applySeenUpdate, mergeMessage, mergeMessages } from "../utils/mergeMessages";

const emojiChoices = ["😀", "😂", "😍", "🙏", "👍", "🔥", "🎉"];

const toReplyPreview = (message: Message): ReplyPreview => ({
  id: message.id,
  senderId: message.senderId,
  receiverId: message.receiverId,
  text: message.text,
  messageType: message.messageType,
  mediaUrl: message.mediaUrl,
  createdAt: message.createdAt,
});

export const ChatScreen = ({ route, navigation }: ChatScreenProps) => {
  const { session, serverReachable } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [peer, setPeer] = useState<User>(route.params.participant);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<PendingMedia | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<ReplyPreview | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isParticipantTyping, setIsParticipantTyping] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isForwardModalVisible, setIsForwardModalVisible] = useState(false);
  const [forwardTargets, setForwardTargets] = useState<User[]>([]);
  const [forwardSourceMessage, setForwardSourceMessage] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPickingAttachment, setIsPickingAttachment] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const typingStopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingActiveRef = useRef(false);
  const currentUserId = session?.user.id || "";
  const token = session?.token || "";

  useEffect(() => {
    void loadCachedConversation(peer.id).then(setMessages);
  }, [peer.id]);

  const loadConversation = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoadingConversation(true);

    try {
      const conversation = await fetchConversation(token, peer.id);
      setMessages(conversation);
      setBannerMessage(null);
      await cacheConversation(peer.id, conversation);
    } catch (error) {
      setBannerMessage(extractApiError(error));
    } finally {
      setIsLoadingConversation(false);
    }
  }, [peer.id, token]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const handleReceiveMessage = (message: Message) => {
      const isConversationMessage =
        (message.senderId === peer.id && message.receiverId === currentUserId) ||
        (message.senderId === currentUserId && message.receiverId === peer.id);

      if (!isConversationMessage) {
        return;
      }

      setMessages((currentMessages) => {
        const nextMessages = mergeMessage(currentMessages, message);
        void cacheConversation(peer.id, nextMessages);
        return nextMessages;
      });

      if (message.senderId === peer.id) {
        setIsParticipantTyping(false);
      }
    };

    const handleMessageSeen = (payload: Parameters<typeof applySeenUpdate>[1]) => {
      const isConversationUpdate =
        (payload.senderId === peer.id && payload.receiverId === currentUserId) ||
        (payload.senderId === currentUserId && payload.receiverId === peer.id);

      if (!isConversationUpdate) {
        return;
      }

      setMessages((currentMessages) => {
        const nextMessages = applySeenUpdate(currentMessages, payload);
        void cacheConversation(peer.id, nextMessages);
        return nextMessages;
      });
    };

    const handleMessageUpdated = (message: Message) => {
      const isConversationMessage =
        (message.senderId === peer.id && message.receiverId === currentUserId) ||
        (message.senderId === currentUserId && message.receiverId === peer.id);

      if (!isConversationMessage) {
        return;
      }

      setMessages((currentMessages) => {
        const nextMessages = mergeMessage(currentMessages, message);
        void cacheConversation(peer.id, nextMessages);
        return nextMessages;
      });
    };

    const handleTypingStart = ({ senderId, receiverId }: { senderId: string; receiverId: string }) => {
      if (senderId === peer.id && receiverId === currentUserId) {
        setIsParticipantTyping(true);
      }
    };

    const handleTypingStop = ({ senderId, receiverId }: { senderId: string; receiverId: string }) => {
      if (senderId === peer.id && receiverId === currentUserId) {
        setIsParticipantTyping(false);
      }
    };

    const handleUserPresence = ({ userId, status, lastSeen }: UserPresencePayload) => {
      if (userId !== peer.id) {
        return;
      }

      setPeer((currentPeer) => ({
        ...currentPeer,
        status,
        lastSeen: lastSeen ?? currentPeer.lastSeen,
      }));
    };

    socketService.onReceiveMessage(handleReceiveMessage);
    socketService.onMessageSeen(handleMessageSeen);
    socketService.onMessageUpdated(handleMessageUpdated);
    socketService.onTypingStart(handleTypingStart);
    socketService.onTypingStop(handleTypingStop);
    socketService.onUserOnline(handleUserPresence);
    socketService.onUserOffline(handleUserPresence);

    return () => {
      socketService.offReceiveMessage(handleReceiveMessage);
      socketService.offMessageSeen(handleMessageSeen);
      socketService.offMessageUpdated(handleMessageUpdated);
      socketService.offTypingStart(handleTypingStart);
      socketService.offTypingStop(handleTypingStop);
      socketService.offUserOnline(handleUserPresence);
      socketService.offUserOffline(handleUserPresence);
    };
  }, [currentUserId, peer.id, token]);

  const hasUnreadIncoming = useMemo(
    () => messages.some((message) => message.senderId === peer.id && message.status !== "seen"),
    [messages, peer.id]
  );

  useEffect(() => {
    if (!token || !hasUnreadIncoming) {
      return undefined;
    }

    const timeoutId = setTimeout(() => {
      void socketService.markMessagesSeen(peer.id);
    }, 250);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [hasUnreadIncoming, peer.id, token]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [isParticipantTyping, messages]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const hasDraftContent = Boolean(draft.trim() || attachment);

    if (!hasDraftContent) {
      if (typingActiveRef.current) {
        typingActiveRef.current = false;
        void socketService.emitTypingStop(peer.id);
      }

      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }

      return undefined;
    }

    if (!typingActiveRef.current) {
      typingActiveRef.current = true;
      void socketService.emitTypingStart(peer.id);
    }

    if (typingStopTimeoutRef.current) {
      clearTimeout(typingStopTimeoutRef.current);
    }

    typingStopTimeoutRef.current = setTimeout(() => {
      typingActiveRef.current = false;
      void socketService.emitTypingStop(peer.id);
      typingStopTimeoutRef.current = null;
    }, 1100);

    return () => {
      if (typingStopTimeoutRef.current) {
        clearTimeout(typingStopTimeoutRef.current);
        typingStopTimeoutRef.current = null;
      }
    };
  }, [attachment, draft, peer.id, token]);

  const filteredMessages = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return messages;
    }

    return messages.filter((message) => {
      const haystack = [message.text, message.mediaName || ""].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [messages, searchQuery]);

  const loadForwardTargets = useCallback(async () => {
    if (!token) {
      return;
    }

    try {
      const nextUsers = await fetchUsers(token);
      setForwardTargets(nextUsers.filter((user) => user.id !== peer.id));
    } catch (error) {
      setBannerMessage(extractApiError(error));
    }
  }, [peer.id, token]);

  const handlePickAttachment = useCallback(async () => {
    if (!token || isPickingAttachment) {
      return;
    }

    Alert.alert("Attach", "Choose what to send", [
      {
        text: "Photo or video",
        onPress: () => void (async () => {
          setIsPickingAttachment(true);

          try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permission.granted) {
              Alert.alert("Permission required", "Allow access to attach media.");
              return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.All,
              allowsEditing: false,
              quality: 0.85,
            });

            if (result.canceled || result.assets.length === 0) {
              return;
            }

            const asset = result.assets[0];
            const mimeType =
              asset.mimeType ||
              (asset.uri.toLowerCase().endsWith(".mp4") ? "video/mp4" : "image/jpeg");
            const messageType = mimeType.startsWith("video/") ? "video" : "image";

            setAttachment({
              uri: asset.uri,
              fileName:
                asset.fileName ||
                asset.uri.split("/").pop() ||
                `media-${Date.now()}.${messageType === "video" ? "mp4" : "jpg"}`,
              mimeType,
              messageType,
              size: asset.fileSize,
              width: asset.width,
              height: asset.height,
              duration: asset.duration,
            });
          } finally {
            setIsPickingAttachment(false);
          }
        })(),
      },
      {
        text: "Document",
        onPress: () => void (async () => {
          setIsPickingAttachment(true);

          try {
            const result = await DocumentPicker.getDocumentAsync({
              copyToCacheDirectory: true,
              multiple: false,
            });

            if (result.canceled || result.assets.length === 0) {
              return;
            }

            const asset = result.assets[0];

            setAttachment({
              uri: asset.uri,
              fileName: asset.name,
              mimeType: asset.mimeType || "application/octet-stream",
              messageType: asset.mimeType?.startsWith("audio/") ? "audio" : "file",
              size: asset.size,
            });
          } finally {
            setIsPickingAttachment(false);
          }
        })(),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [isPickingAttachment, token]);

  const handleVoicePress = useCallback(async () => {
    if (!token) {
      return;
    }

    if (isRecording) {
      const recording = recordingRef.current;

      if (!recording) {
        return;
      }

      await recording.stopAndUnloadAsync();
      const status = await recording.getStatusAsync();
      const uri = recording.getURI();

      recordingRef.current = null;
      setIsRecording(false);

      if (!uri) {
        return;
      }

      setAttachment({
        uri,
        fileName: `voice-note-${Date.now()}.m4a`,
        mimeType: "audio/m4a",
        messageType: "audio",
        duration:
          typeof status === "object" && "durationMillis" in status
            ? status.durationMillis || null
            : null,
      });
      return;
    }

    const permission = await Audio.requestPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Allow microphone access to record voice notes.");
      return;
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    recordingRef.current = recording;
    setIsRecording(true);
  }, [isRecording, token]);

  const handleSend = useCallback(async () => {
    const text = draft.trim();

    if (!text && !attachment) {
      return;
    }

    const nextAttachment = attachment;
    const createdAt = new Date().toISOString();
    const clientTempId = `client-${Date.now()}`;
    const optimisticMessage: Message = {
      id: clientTempId,
      clientTempId,
      senderId: currentUserId,
      receiverId: peer.id,
      text,
      messageType: nextAttachment?.messageType ?? "text",
      mediaUrl: nextAttachment?.uri ?? "",
      mediaName: nextAttachment?.fileName ?? "",
      mediaMimeType: nextAttachment?.mimeType ?? "",
      fileSize: nextAttachment?.size ?? null,
      voiceNoteDuration:
        nextAttachment?.messageType === "audio" && nextAttachment.duration
          ? Math.round((nextAttachment.duration || 0) / 1000)
          : null,
      replyToMessage: replyToMessage || null,
      createdAt,
      status: "sent",
      deliveredAt: null,
      seenAt: null,
      isOptimistic: true,
    };

    setMessages((currentMessages) => {
      const nextMessages = mergeMessage(currentMessages, optimisticMessage);
      void cacheConversation(peer.id, nextMessages);
      return nextMessages;
    });
    setDraft("");
    setAttachment(null);
    setReplyToMessage(null);
    setIsSending(true);

    try {
      let payload: SendMessagePayload = {
        receiverId: peer.id,
        text,
        clientTempId,
        messageType: optimisticMessage.messageType,
        mediaUrl: optimisticMessage.mediaUrl,
        mediaName: optimisticMessage.mediaName,
        mediaMimeType: optimisticMessage.mediaMimeType,
        fileSize: optimisticMessage.fileSize,
        voiceNoteDuration: optimisticMessage.voiceNoteDuration,
        replyToMessageId: replyToMessage?.id || null,
      };

      if (nextAttachment) {
        const upload = await uploadMedia(token, nextAttachment);
        payload = {
          ...payload,
          messageType: upload.mediaType,
          mediaUrl: upload.url,
          mediaName: upload.fileName,
          mediaMimeType: upload.mimeType,
          fileSize: upload.size,
        };
      }

      const socketAck = socketService.isConnected()
        ? await socketService.sendMessage(payload)
        : null;

      if (socketAck?.ok && socketAck.message) {
        setMessages((currentMessages) => {
          const nextMessages = mergeMessage(currentMessages, socketAck.message as Message);
          void cacheConversation(peer.id, nextMessages);
          return nextMessages;
        });
      } else {
        const persistedMessage = await sendMessageRequest(token, payload);
        setMessages((currentMessages) => {
          const nextMessages = mergeMessage(currentMessages, persistedMessage);
          void cacheConversation(peer.id, nextMessages);
          return nextMessages;
        });
      }
    } catch (error) {
      setBannerMessage(extractApiError(error));
    } finally {
      setIsSending(false);
    }
  }, [attachment, currentUserId, draft, peer.id, replyToMessage, token]);

  const handleMessageAction = useCallback(
    (message: Message) => {
      const isOwnMessage = message.senderId === currentUserId;

      Alert.alert("Message actions", "Choose what to do", [
        {
          text: "Reply",
          onPress: () => setReplyToMessage(toReplyPreview(message)),
        },
        {
          text: "Forward",
          onPress: () => {
            setForwardSourceMessage(message);
            setIsForwardModalVisible(true);
            void loadForwardTargets();
          },
        },
        {
          text: "Delete for me",
          style: "destructive",
          onPress: () =>
            void (async () => {
              try {
                const nextMessage = await deleteMessageRequest(token, message.id, "for_me");
                setMessages((currentMessages) => {
                  const nextMessages = mergeMessage(currentMessages, nextMessage);
                  void cacheConversation(peer.id, nextMessages);
                  return nextMessages;
                });
              } catch (error) {
                setBannerMessage(extractApiError(error));
              }
            })(),
        },
        ...(isOwnMessage
          ? [
              {
                text: "Delete for everyone",
                style: "destructive" as const,
                onPress: () =>
                  void (async () => {
                    try {
                      const nextMessage = await deleteMessageRequest(
                        token,
                        message.id,
                        "for_everyone"
                      );
                      setMessages((currentMessages) => {
                        const nextMessages = mergeMessage(currentMessages, nextMessage);
                        void cacheConversation(peer.id, nextMessages);
                        return nextMessages;
                      });
                    } catch (error) {
                      setBannerMessage(extractApiError(error));
                    }
                  })(),
              },
            ]
          : []),
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [currentUserId, loadForwardTargets, peer.id, token]
  );

  const handleForwardToUser = useCallback(
    async (receiver: User) => {
      if (!forwardSourceMessage) {
        return;
      }

      try {
        await forwardMessageRequest(token, forwardSourceMessage.id, receiver.id);
        setIsForwardModalVisible(false);
        setForwardSourceMessage(null);
      } catch (error) {
        setBannerMessage(extractApiError(error));
      }
    },
    [forwardSourceMessage, token]
  );

  const handleStartCall = useCallback(
    async (type: "voice" | "video") => {
      try {
        const call = await createCallRequest(token, peer.id, type);
        navigation.navigate("Call", {
          call,
          participant: peer,
        });
      } catch (error) {
        setBannerMessage(extractApiError(error));
      }
    },
    [navigation, peer, token]
  );

  const headerStatus = isParticipantTyping
    ? "typing..."
    : formatPresenceText(peer.status, peer.lastSeen);

  return (
    <View style={[styles.container, { backgroundColor: colors.screen }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.header,
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.surface} />
          </Pressable>

          <View style={styles.peerMeta}>
            <Avatar name={peer.name} profilePic={peer.profilePic} size={42} />
            <View style={styles.peerCopy}>
              <Text style={[styles.peerName, { color: colors.surface }]} numberOfLines={1}>
                {peer.name}
              </Text>
              <Text style={[styles.peerStatus, { color: colors.tabInactive }]} numberOfLines={1}>
                {headerStatus}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={styles.headerIconButton}
              onPress={() => void handleStartCall("video")}
            >
              <Ionicons name="videocam-outline" size={20} color={colors.surface} />
            </Pressable>
            <Pressable
              style={styles.headerIconButton}
              onPress={() => void handleStartCall("voice")}
            >
              <Ionicons name="call-outline" size={20} color={colors.surface} />
            </Pressable>
            <Pressable
              style={styles.headerIconButton}
              onPress={() => setIsSearchOpen((current) => !current)}
            >
              <Ionicons name="search-outline" size={18} color={colors.surface} />
            </Pressable>
          </View>
        </View>
        {isSearchOpen ? (
          <View style={styles.searchWrap}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search in conversation"
              placeholderTextColor={colors.tabInactive}
              style={[
                styles.searchInput,
                {
                  color: colors.surface,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.16)",
                },
              ]}
            />
          </View>
        ) : null}
      </View>

      {bannerMessage ? (
        <View
          style={[
            styles.banner,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.bannerText, { color: colors.textSecondary }]}>{bannerMessage}</Text>
        </View>
      ) : null}

      {!serverReachable ? (
        <View style={styles.offlineBanner}>
          <Text style={[styles.offlineText, { color: colors.textSecondary }]}>
            You are viewing cached messages until the backend reconnects.
          </Text>
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 82 : 0}
      >
        <View style={styles.contentWrap}>
          {isLoadingConversation && messages.length === 0 ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                Loading conversation...
              </Text>
            </View>
          ) : null}

          <FlatList
            ref={listRef}
            data={filteredMessages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble
                message={item}
                isOwnMessage={item.senderId === currentUserId}
                onLongPress={handleMessageAction}
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListFooterComponent={isParticipantTyping ? <TypingIndicator name={peer.name} /> : null}
            ListEmptyComponent={
              !isLoadingConversation ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                    Start the conversation
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Send a text, voice note, photo, or document to begin.
                  </Text>
                </View>
              ) : null
            }
          />

          <View style={styles.emojiRow}>
            {emojiChoices.map((emoji) => (
              <Pressable
                key={emoji}
                style={[
                  styles.emojiChip,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={() => setDraft((currentDraft) => `${currentDraft}${emoji}`)}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          <ChatInput
            value={draft}
            onChangeText={setDraft}
            onSend={() => void handleSend()}
            onAttachPress={() => void handlePickAttachment()}
            onVoicePress={() => void handleVoicePress()}
            onRemoveAttachment={() => setAttachment(null)}
            onCancelReply={() => setReplyToMessage(null)}
            attachment={attachment}
            replyToMessage={replyToMessage}
            isSending={isSending}
            isRecording={isRecording}
          />
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={isForwardModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsForwardModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsForwardModalVisible(false)}
          />
          <View
            style={[
              styles.modalSheet,
              {
                backgroundColor: colors.surface,
                borderColor: colors.cardBorder,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                Forward message
              </Text>
              <Pressable
                onPress={() => setIsForwardModalVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
            <FlatList
              data={forwardTargets}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => void handleForwardToUser(item)}
                  style={[
                    styles.forwardRow,
                    {
                      borderBottomColor: colors.cardBorder,
                    },
                  ]}
                >
                  <Avatar name={item.name} profilePic={item.profilePic} size={48} />
                  <View style={styles.forwardCopy}>
                    <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                    <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                      {item.about || item.phone}
                    </Text>
                  </View>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: spacing.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  searchWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  searchInput: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  peerMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  peerCopy: {
    flex: 1,
    justifyContent: "center",
  },
  peerName: {
    fontSize: 16,
    fontWeight: "900",
  },
  peerStatus: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  headerIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    ...shadows.soft,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  offlineBanner: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  offlineText: {
    fontSize: 12,
  },
  keyboardWrap: {
    flex: 1,
  },
  contentWrap: {
    flex: 1,
    paddingTop: spacing.sm,
  },
  loadingState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 13,
  },
  listContent: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  emptySubtitle: {
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
  },
  emojiRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xs,
  },
  emojiChip: {
    minWidth: 40,
    height: 34,
    borderRadius: radii.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  emojiText: {
    fontSize: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: "86%",
    gap: spacing.md,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  forwardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  forwardCopy: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
});
