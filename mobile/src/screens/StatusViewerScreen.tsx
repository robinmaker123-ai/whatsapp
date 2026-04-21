import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { deleteStatusRequest, markStatusViewedRequest } from "../services/api";
import { radii, spacing, useAppTheme } from "../theme";
import type { StatusViewerScreenProps } from "../types/navigation";
import type { StatusItem } from "../types/models";
import { formatMessageTime } from "../utils/format";

const STATUS_ADVANCE_MS = 4000;
const VIDEO_ADVANCE_MS = 6500;

const clampIndex = (index: number, length: number) => {
  if (length <= 0) {
    return 0;
  }

  return Math.min(Math.max(index, 0), length - 1);
};

export const StatusViewerScreen = ({
  route,
  navigation,
}: StatusViewerScreenProps) => {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [statuses, setStatuses] = useState<StatusItem[]>(() =>
    [...route.params.entry.statuses].sort(
      (firstStatus, secondStatus) =>
        new Date(firstStatus.createdAt).getTime() -
        new Date(secondStatus.createdAt).getTime()
    )
  );
  const [activeIndex, setActiveIndex] = useState(
    clampIndex(route.params.initialIndex || 0, route.params.entry.statuses.length)
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const token = session?.token || "";
  const currentStatus = statuses[activeIndex];
  const isOwnStatus = session?.user.id === route.params.entry.user.id;

  const closeViewer = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Home");
    }
  }, [navigation]);

  useEffect(() => {
    if (!currentStatus || !token) {
      return;
    }

    void markStatusViewedRequest(token, currentStatus.id);
  }, [currentStatus, token]);

  useEffect(() => {
    if (!currentStatus) {
      closeViewer();
      return undefined;
    }

    progress.stopAnimation();
    progress.setValue(0);

    const duration =
      currentStatus.type === "video" ? VIDEO_ADVANCE_MS : STATUS_ADVANCE_MS;

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (!finished) {
        return;
      }

      setActiveIndex((currentIndex) => {
        if (currentIndex >= statuses.length - 1) {
          closeViewer();
          return currentIndex;
        }

        return currentIndex + 1;
      });
    });

    return () => {
      animation.stop();
    };
  }, [closeViewer, currentStatus, progress, statuses.length]);

  const handleStep = (direction: "next" | "previous") => {
    setErrorMessage(null);
    setActiveIndex((currentIndex) => {
      const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;

      if (nextIndex < 0) {
        return 0;
      }

      if (nextIndex >= statuses.length) {
        closeViewer();
        return currentIndex;
      }

      return nextIndex;
    });
  };

  const handleDelete = async () => {
    if (!token || !currentStatus) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);

    try {
      await deleteStatusRequest(token, currentStatus.id);
      setStatuses((currentStatuses) => {
        const nextStatuses = currentStatuses.filter(
          (statusItem) => statusItem.id !== currentStatus.id
        );

        if (nextStatuses.length === 0) {
          closeViewer();
          return nextStatuses;
        }

        setActiveIndex((currentIndex) =>
          clampIndex(currentIndex, nextStatuses.length)
        );
        return nextStatuses;
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete the status.";
      setErrorMessage(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const progressBars = useMemo(
    () =>
      statuses.map((status, index) => {
        if (index < activeIndex) {
          return 1;
        }

        if (index > activeIndex) {
          return 0;
        }

        return progress;
      }),
    [activeIndex, progress, statuses]
  );

  if (!currentStatus) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: "#09120F" }]}>
      <View
        style={[
          styles.topOverlay,
          {
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <View style={styles.progressRow}>
          {progressBars.map((progressValue, index) => (
            <View key={statuses[index].id} style={styles.progressTrack}>
              {typeof progressValue === "number" ? (
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progressValue * 100}%`,
                    },
                  ]}
                />
              ) : (
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressValue.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0%", "100%"],
                      }),
                    },
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        <View style={styles.headerRow}>
          <Pressable style={styles.iconButton} onPress={closeViewer}>
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerMeta}>
            <Avatar
              name={route.params.entry.user.name}
              profilePic={route.params.entry.user.profilePic}
              size={42}
            />
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>{route.params.entry.user.name}</Text>
              <Text style={styles.headerSubtitle}>
                {formatMessageTime(currentStatus.createdAt)}
              </Text>
            </View>
          </View>
          {isOwnStatus ? (
            <Pressable
              style={styles.iconButton}
              onPress={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
              )}
            </Pressable>
          ) : (
            <View style={styles.iconButton} />
          )}
        </View>
      </View>

      <Pressable style={styles.leftTapZone} onPress={() => handleStep("previous")} />
      <Pressable style={styles.rightTapZone} onPress={() => handleStep("next")} />

      {currentStatus.type === "image" && currentStatus.mediaUrl ? (
        <Image
          source={{ uri: currentStatus.mediaUrl }}
          style={styles.visualStatus}
          resizeMode="cover"
        />
      ) : currentStatus.type === "video" && currentStatus.mediaUrl ? (
        <Video
          source={{ uri: currentStatus.mediaUrl }}
          style={styles.visualStatus}
          resizeMode={ResizeMode.COVER}
          shouldPlay
          isLooping
        />
      ) : (
        <View
          style={[
            styles.textStatusCard,
            {
              backgroundColor: currentStatus.backgroundColor || colors.primary,
            },
          ]}
        >
          <Text style={styles.textStatusCopy}>
            {currentStatus.text || "Status update"}
          </Text>
        </View>
      )}

      {(currentStatus.text && currentStatus.type !== "text") || errorMessage || isOwnStatus ? (
        <View
          style={[
            styles.bottomOverlay,
            {
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
        >
          {currentStatus.text && currentStatus.type !== "text" ? (
            <Text style={styles.captionText}>{currentStatus.text}</Text>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          {isOwnStatus ? (
            <View style={styles.viewerCard}>
              <View style={styles.viewerHeader}>
                <Text style={styles.viewerTitle}>Viewers</Text>
                <Text style={styles.viewerCount}>
                  {currentStatus.viewers.length}
                </Text>
              </View>

              {currentStatus.viewers.length === 0 ? (
                <Text style={styles.viewerEmpty}>No one has seen this status yet.</Text>
              ) : (
                currentStatus.viewers.slice(0, 5).map((viewer) => (
                  <View key={viewer.userId} style={styles.viewerRow}>
                    <Avatar
                      name={viewer.user?.name || "Viewer"}
                      profilePic={viewer.user?.profilePic}
                      size={34}
                    />
                    <View style={styles.viewerCopy}>
                      <Text style={styles.viewerName}>
                        {viewer.user?.name || viewer.userId}
                      </Text>
                      <Text style={styles.viewerSeenAt}>
                        Seen at {formatMessageTime(viewer.viewedAt)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    paddingHorizontal: spacing.md,
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: radii.full,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerMeta: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    marginTop: 2,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  leftTapZone: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: "34%",
    zIndex: 1,
  },
  rightTapZone: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    width: "34%",
    zIndex: 1,
  },
  visualStatus: {
    width: "100%",
    height: "100%",
  },
  textStatusCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xxl,
  },
  textStatusCopy: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
    lineHeight: 38,
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  captionText: {
    color: "#FFFFFF",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  errorText: {
    color: "#FFD7D7",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  viewerCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    backgroundColor: "rgba(0,0,0,0.36)",
    gap: spacing.md,
  },
  viewerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  viewerTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  viewerCount: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
  viewerEmpty: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 13,
  },
  viewerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  viewerCopy: {
    flex: 1,
  },
  viewerName: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  viewerSeenAt: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 2,
  },
});
