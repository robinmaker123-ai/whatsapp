import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { radii, spacing, useAppTheme } from "../theme";
import type { PendingMedia, ReplyPreview } from "../types/models";
import { getInitials } from "../utils/format";

type ChatInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onAttachPress: () => void;
  onVoicePress: () => void;
  onRemoveAttachment: () => void;
  onCancelReply: () => void;
  attachment: PendingMedia | null;
  replyToMessage?: ReplyPreview | null;
  isSending: boolean;
  isRecording: boolean;
};

const getAttachmentTitle = (attachment: PendingMedia) => {
  switch (attachment.messageType) {
    case "video":
      return "Video ready";
    case "audio":
      return "Voice note ready";
    case "file":
      return "Document ready";
    default:
      return "Photo ready";
  }
};

export const ChatInput = ({
  value,
  onChangeText,
  onSend,
  onAttachPress,
  onVoicePress,
  onRemoveAttachment,
  onCancelReply,
  attachment,
  replyToMessage,
  isSending,
  isRecording,
}: ChatInputProps) => {
  const { colors } = useAppTheme();
  const isSendDisabled = (!value.trim() && !attachment) || isSending;
  const isAttachDisabled = isSending;
  const isRemoveDisabled = isSending;

  return (
    <View
      style={[
        styles.wrapper,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.cardBorder,
        },
      ]}
    >
      {replyToMessage ? (
        <View
          style={[
            styles.replyCard,
            {
              backgroundColor: colors.surfaceMuted,
              borderLeftColor: colors.primary,
            },
          ]}
        >
          <View style={styles.replyCopy}>
            <Text style={[styles.replyLabel, { color: colors.primaryDark }]}>
              Replying to {getInitials(replyToMessage.senderId)}
            </Text>
            <Text style={[styles.replyText, { color: colors.textSecondary }]} numberOfLines={1}>
              {replyToMessage.text || "Attachment"}
            </Text>
          </View>
          <Pressable onPress={onCancelReply} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {attachment ? (
        <View
          style={[
            styles.attachmentCard,
            {
              backgroundColor: colors.surfaceMuted,
            },
          ]}
        >
          {attachment.messageType === "image" ? (
            <Image source={{ uri: attachment.uri }} style={styles.attachmentPreview} />
          ) : (
            <View
              style={[
                styles.attachmentPreview,
                styles.filePreview,
                {
                  backgroundColor: colors.primaryDark,
                },
              ]}
            >
              <Ionicons
                name={
                  attachment.messageType === "video"
                    ? "videocam"
                    : attachment.messageType === "audio"
                      ? "mic"
                      : "document"
                }
                size={22}
                color={colors.surface}
              />
            </View>
          )}

          <View style={styles.attachmentCopy}>
            <Text style={[styles.attachmentLabel, { color: colors.textPrimary }]}>
              {getAttachmentTitle(attachment)}
            </Text>
            <Text
              style={[styles.attachmentName, { color: colors.textSecondary }]}
              numberOfLines={1}
            >
              {attachment.fileName}
            </Text>
          </View>

          <Pressable
            style={[
              styles.removeButton,
              {
                backgroundColor: colors.surface,
              },
            ]}
            onPress={onRemoveAttachment}
            disabled={isRemoveDisabled}
          >
            <Text style={[styles.removeButtonText, { color: colors.primaryDark }]}>
              Remove
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.composerRow}>
        <Pressable
          style={[
            styles.iconButton,
            {
              backgroundColor: colors.surfaceMuted,
            },
            isAttachDisabled && styles.buttonDisabled,
          ]}
          onPress={onAttachPress}
          disabled={isAttachDisabled}
        >
          <Ionicons name="add" size={24} color={colors.primaryDark} />
        </Pressable>
        <TextInput
          placeholder={attachment ? "Add a caption" : "Type a message"}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            {
              backgroundColor: colors.surfaceMuted,
              color: colors.textPrimary,
            },
          ]}
          multiline
          value={value}
          onChangeText={onChangeText}
        />
        {!value.trim() && !attachment ? (
          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor: isRecording ? colors.danger : colors.primary,
              },
            ]}
            onPress={onVoicePress}
          >
            {isRecording ? (
              <Ionicons name="stop" size={20} color={colors.surface} />
            ) : (
              <Ionicons name="mic" size={20} color={colors.surface} />
            )}
          </Pressable>
        ) : (
          <Pressable
            style={[
              styles.iconButton,
              {
                backgroundColor: colors.primary,
              },
              isSendDisabled && styles.buttonDisabled,
            ]}
            onPress={onSend}
            disabled={isSendDisabled}
          >
            {isSending ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Ionicons name="send" size={18} color={colors.surface} />
            )}
          </Pressable>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    gap: spacing.sm,
  },
  replyCard: {
    borderLeftWidth: 3,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  replyCopy: {
    flex: 1,
    gap: 2,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  replyText: {
    fontSize: 13,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  attachmentCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  attachmentPreview: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  filePreview: {
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentCopy: {
    flex: 1,
    gap: 2,
  },
  attachmentLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  attachmentName: {
    fontSize: 12,
  },
  removeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
