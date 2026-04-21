import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { spacing, useAppTheme } from "../theme";
import type { ChatSummary } from "../types/models";
import { formatChatPreviewTime, formatPresenceText } from "../utils/format";
import { getMessagePreview } from "../utils/messageContent";
import { Avatar } from "./Avatar";

type ChatListItemProps = {
  chat: ChatSummary;
  currentUserId: string;
  onPress: () => void;
  onLongPress?: () => void;
};

export const ChatListItem = ({
  chat,
  currentUserId,
  onPress,
  onLongPress,
}: ChatListItemProps) => {
  const { colors, isDark } = useAppTheme();
  const isOwnLastMessage = chat.lastMessage?.senderId === currentUserId;
  const previewText = getMessagePreview(chat.lastMessage, isOwnLastMessage);
  const presenceText = formatPresenceText(chat.user.status, chat.user.lastSeen);

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.cardBorder,
        },
      ]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <Avatar name={chat.user.name} profilePic={chat.user.profilePic} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameBlock}>
            <View style={styles.nameRow}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {chat.user.name}
              </Text>
              {chat.isPinned ? (
                <Ionicons name="pin" size={12} color={colors.primaryDark} />
              ) : null}
              {chat.user.status === "online" ? (
                <View
                  style={[
                    styles.onlineDot,
                    {
                      backgroundColor: colors.accent,
                    },
                  ]}
                />
              ) : null}
            </View>
            <Text style={[styles.presence, { color: colors.textSecondary }]} numberOfLines={1}>
              {presenceText}
            </Text>
          </View>
          <Text style={[styles.time, { color: colors.textSecondary }]}>
            {formatChatPreviewTime(chat.lastMessage?.createdAt)}
          </Text>
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
            {previewText}
          </Text>

          {chat.unreadCount > 0 ? (
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: isDark ? colors.accent : colors.unreadBadge,
                },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.surface }]}>{chat.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  content: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  nameBlock: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    flexShrink: 1,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  presence: {
    fontSize: 12,
  },
  time: {
    fontSize: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  preview: {
    flex: 1,
    fontSize: 14,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
