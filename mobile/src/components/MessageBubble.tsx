import { useEffect, useRef, useState } from "react";
import { Audio } from "expo-av";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { radii, shadows, spacing, useAppTheme } from "../theme";
import type { Message } from "../types/models";
import { formatDuration, formatMessageTime } from "../utils/format";

type MessageBubbleProps = {
  message: Message;
  isOwnMessage: boolean;
  onLongPress?: (message: Message) => void;
};

const renderStatus = (status: Message["status"]) => {
  if (status === "seen") {
    return "\u2713\u2713";
  }

  if (status === "delivered") {
    return "\u2713\u2713";
  }

  return "\u2713";
};

const hasVisualMedia = (message: Message) =>
  Boolean(message.mediaUrl && ["image", "video"].includes(message.messageType));

export const MessageBubble = ({
  message,
  isOwnMessage,
  onLongPress,
}: MessageBubbleProps) => {
  const { colors } = useAppTheme();
  const receiptText = message.isOptimistic ? "..." : renderStatus(message.status);
  const mediaVisible = hasVisualMedia(message);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    return () => {
      void audioRef.current?.unloadAsync();
    };
  }, []);

  const handlePlayAudio = async () => {
    if (!message.mediaUrl) {
      return;
    }

    if (isPlayingAudio) {
      await audioRef.current?.stopAsync();
      setIsPlayingAudio(false);
      return;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: message.mediaUrl },
      { shouldPlay: true }
    );

    audioRef.current = sound;
    setIsPlayingAudio(true);

    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || !status.didJustFinish) {
        return;
      }

      setIsPlayingAudio(false);
      void sound.unloadAsync();
    });
  };

  return (
    <Pressable
      onLongPress={() => onLongPress?.(message)}
      delayLongPress={220}
      style={[
        styles.row,
        isOwnMessage ? styles.rowOutgoing : styles.rowIncoming,
      ]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isOwnMessage
              ? colors.outgoingBubble
              : colors.incomingBubble,
          },
          isOwnMessage ? styles.outgoingBubble : styles.incomingBubble,
        ]}
      >
        {message.forwardedFrom ? (
          <Text style={[styles.forwardedLabel, { color: colors.textSecondary }]}>
            Forwarded
          </Text>
        ) : null}

        {message.replyToMessage ? (
          <View
            style={[
              styles.replyPreview,
              {
                backgroundColor: colors.surfaceMuted,
                borderLeftColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.replySender, { color: colors.primaryDark }]}>
              {message.replyToMessage.senderId === message.senderId ? "You" : "Reply"}
            </Text>
            <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
              {message.replyToMessage.text || "Attachment"}
            </Text>
          </View>
        ) : null}

        {mediaVisible ? (
          <View style={styles.mediaWrap}>
            <Image
              source={{ uri: message.mediaUrl }}
              style={styles.mediaPreview}
              resizeMode="cover"
            />
            {message.messageType === "video" ? (
              <View style={[styles.mediaOverlay, { backgroundColor: colors.overlay }]}>
                <Ionicons name="play" size={22} color={colors.surface} />
              </View>
            ) : null}
          </View>
        ) : null}

        {message.messageType === "audio" && message.mediaUrl ? (
          <Pressable
            onPress={() => void handlePlayAudio()}
            style={[
              styles.audioCard,
              {
                backgroundColor: colors.surfaceMuted,
              },
            ]}
          >
            <Ionicons
              name={isPlayingAudio ? "pause" : "play"}
              size={18}
              color={colors.primaryDark}
            />
            <View style={styles.audioCopy}>
              <Text style={[styles.audioLabel, { color: colors.textPrimary }]}>
                Voice note
              </Text>
              <Text style={[styles.audioDuration, { color: colors.textSecondary }]}>
                {formatDuration(message.voiceNoteDuration)}
              </Text>
            </View>
          </Pressable>
        ) : null}

        {message.messageType === "file" && message.mediaUrl ? (
          <View
            style={[
              styles.fileCard,
              {
                backgroundColor: colors.surfaceMuted,
              },
            ]}
          >
            <Ionicons name="document" size={18} color={colors.primaryDark} />
            <View style={styles.fileCopy}>
              <Text style={[styles.fileLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                {message.mediaName || "Document"}
              </Text>
              <Text style={[styles.fileMeta, { color: colors.textSecondary }]}>
                {(message.fileSize || 0) > 0
                  ? `${Math.ceil((message.fileSize || 0) / 1024)} KB`
                  : "Tap to download"}
              </Text>
            </View>
          </View>
        ) : null}

        {message.text ? (
          <Text style={[styles.messageText, { color: colors.textPrimary }]}>
            {message.deletedForEveryone ? "This message was deleted" : message.text}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <Text style={[styles.timeText, { color: colors.textSecondary }]}>
            {formatMessageTime(message.createdAt)}
          </Text>
          {isOwnMessage ? (
            <Text
              style={[
                styles.statusText,
                {
                  color:
                    message.status === "seen"
                      ? colors.readReceipt
                      : colors.textMuted,
                },
              ]}
            >
              {receiptText}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  rowIncoming: {
    alignItems: "flex-start",
  },
  rowOutgoing: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
    ...shadows.soft,
  },
  outgoingBubble: {
    borderBottomRightRadius: 6,
  },
  incomingBubble: {
    borderBottomLeftRadius: 6,
  },
  forwardedLabel: {
    fontSize: 11,
    fontWeight: "800",
  },
  replyPreview: {
    borderLeftWidth: 3,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
  },
  replySender: {
    fontSize: 11,
    fontWeight: "800",
  },
  replyText: {
    fontSize: 12,
  },
  mediaWrap: {
    position: "relative",
    marginBottom: spacing.xs,
  },
  mediaPreview: {
    width: 220,
    height: 180,
    borderRadius: radii.sm,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  mediaOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: radii.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  audioCard: {
    minWidth: 180,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  audioCopy: {
    gap: 2,
  },
  audioLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  audioDuration: {
    fontSize: 11,
  },
  fileCard: {
    minWidth: 180,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  fileCopy: {
    flex: 1,
  },
  fileLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  fileMeta: {
    fontSize: 11,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  timeText: {
    fontSize: 11,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
