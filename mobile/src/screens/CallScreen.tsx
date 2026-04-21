import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
import { updateCallRequest } from "../services/api";
import { socketService } from "../services/socketService";
import { radii, shadows, spacing, useAppTheme } from "../theme";
import type { CallScreenProps } from "../types/navigation";
import type { CallRecord } from "../types/models";
import { formatDuration } from "../utils/format";

const terminalStatuses = new Set<CallRecord["status"]>([
  "rejected",
  "missed",
  "ended",
  "cancelled",
]);

const formatCallStatus = (call: CallRecord, isIncoming: boolean) => {
  switch (call.status) {
    case "accepted":
      return "Connected";
    case "rejected":
      return isIncoming ? "Call declined" : "Declined";
    case "missed":
      return "Missed call";
    case "ended":
      return "Call ended";
    case "cancelled":
      return "Call cancelled";
    default:
      return isIncoming ? "Incoming call" : "Calling...";
  }
};

export const CallScreen = ({ route, navigation }: CallScreenProps) => {
  const { session } = useAuth();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [call, setCall] = useState(route.params.call);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(call.type === "video");
  const [isVideoEnabled, setIsVideoEnabled] = useState(call.type === "video");
  const [remoteControlState, setRemoteControlState] = useState<{
    isMuted?: boolean;
    isSpeakerOn?: boolean;
    isVideoEnabled?: boolean;
  } | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isUpdatingCall, setIsUpdatingCall] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const token = session?.token || "";
  const participant = route.params.participant;
  const isIncoming = Boolean(route.params.isIncoming);
  const currentUserId = session?.user.id || "";
  const remoteUserId =
    call.callerId === currentUserId ? call.receiverId : call.callerId;
  const offerSentRef = useRef(false);
  const didAutoCloseRef = useRef(false);

  const callStatusText = useMemo(
    () => formatCallStatus(call, isIncoming),
    [call, isIncoming]
  );

  useEffect(() => {
    if (!call.startedAt || call.status !== "accepted") {
      setElapsedSeconds(0);
      return undefined;
    }

    const updateElapsed = () => {
      const startedAtMs = new Date(call.startedAt || Date.now()).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    };

    updateElapsed();
    const intervalId = setInterval(updateElapsed, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [call.startedAt, call.status]);

  useEffect(() => {
    if (
      isIncoming ||
      offerSentRef.current ||
      !token ||
      call.status !== "ringing"
    ) {
      return;
    }

    offerSentRef.current = true;
    void socketService.sendCallOffer({
      callId: call.id,
      roomId: call.roomId,
      receiverId: remoteUserId,
      type: call.type,
      offer: {
        initiatedAt: new Date().toISOString(),
      },
    });
  }, [call.id, call.roomId, call.status, call.type, isIncoming, remoteUserId, token]);

  useEffect(() => {
    const handleCallUpdated = (nextCall: CallRecord) => {
      if (nextCall.id === call.id) {
        setCall(nextCall);
      }
    };

    const handleCallControl = (payload: {
      callId: string;
      senderId?: string;
      control?: {
        isMuted?: boolean;
        isSpeakerOn?: boolean;
        isVideoEnabled?: boolean;
      } | null;
    }) => {
      if (payload.callId !== call.id || payload.senderId !== remoteUserId) {
        return;
      }

      setRemoteControlState(payload.control || null);
    };

    const handleCallEnd = (payload: { callId: string }) => {
      if (payload.callId !== call.id) {
        return;
      }

      setCall((currentCall) => ({
        ...currentCall,
        status: currentCall.status === "accepted" ? "ended" : "cancelled",
        endedAt: new Date().toISOString(),
      }));
    };

    socketService.onCallUpdated(handleCallUpdated);
    socketService.onCallControl(handleCallControl);
    socketService.onCallEnd(handleCallEnd);

    return () => {
      socketService.offCallUpdated(handleCallUpdated);
      socketService.offCallControl(handleCallControl);
      socketService.offCallEnd(handleCallEnd);
    };
  }, [call.id, remoteUserId]);

  useEffect(() => {
    if (!terminalStatuses.has(call.status) || didAutoCloseRef.current) {
      return undefined;
    }

    didAutoCloseRef.current = true;
    const timeoutId = setTimeout(() => {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate("Home");
      }
    }, 1400);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [call.status, navigation]);

  const syncControls = useCallback(
    async (nextControls: {
      isMuted?: boolean;
      isSpeakerOn?: boolean;
      isVideoEnabled?: boolean;
    }) => {
      await socketService.sendCallControl({
        callId: call.id,
        roomId: call.roomId,
        receiverId: remoteUserId,
        control: nextControls,
      });
    },
    [call.id, call.roomId, remoteUserId]
  );

  const handleAccept = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsUpdatingCall(true);
    setErrorMessage(null);

    try {
      const nextCall = await updateCallRequest(token, call.id, "accepted");
      setCall(nextCall);
      await socketService.sendCallAnswer({
        callId: call.id,
        roomId: call.roomId,
        receiverId: remoteUserId,
        answer: {
          acceptedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to accept the call.";
      setErrorMessage(message);
    } finally {
      setIsUpdatingCall(false);
    }
  }, [call.id, call.roomId, remoteUserId, token]);

  const handleFinishCall = useCallback(
    async (nextStatus: CallRecord["status"]) => {
      if (!token) {
        return;
      }

      setIsUpdatingCall(true);
      setErrorMessage(null);

      try {
        const nextCall = await updateCallRequest(token, call.id, nextStatus);
        setCall(nextCall);
        await socketService.endCall({
          callId: call.id,
          roomId: call.roomId,
          receiverId: remoteUserId,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to update the call.";
        setErrorMessage(message);
      } finally {
        setIsUpdatingCall(false);
      }
    },
    [call.id, call.roomId, remoteUserId, token]
  );

  const handleClosePress = useCallback(() => {
    if (call.status === "ringing") {
      const nextStatus: CallRecord["status"] = isIncoming ? "rejected" : "cancelled";
      void handleFinishCall(nextStatus);
      return;
    }

    if (call.status === "accepted") {
      void handleFinishCall("ended");
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("Home");
    }
  }, [call.status, handleFinishCall, isIncoming, navigation]);

  const toggleMute = async () => {
    const nextValue = !isMuted;
    setIsMuted(nextValue);
    await syncControls({
      isMuted: nextValue,
      isSpeakerOn,
      isVideoEnabled,
    });
  };

  const toggleSpeaker = async () => {
    const nextValue = !isSpeakerOn;
    setIsSpeakerOn(nextValue);
    await syncControls({
      isMuted,
      isSpeakerOn: nextValue,
      isVideoEnabled,
    });
  };

  const toggleVideo = async () => {
    const nextValue = !isVideoEnabled;
    setIsVideoEnabled(nextValue);
    await syncControls({
      isMuted,
      isSpeakerOn,
      isVideoEnabled: nextValue,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.header }]}>
      <View
        style={[
          styles.backdropOrbLarge,
          {
            backgroundColor: colors.headerAccent,
          },
        ]}
      />
      <View
        style={[
          styles.backdropOrbSmall,
          {
            backgroundColor: colors.primary,
          },
        ]}
      />

      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.md,
          },
        ]}
      >
        <Pressable style={styles.headerIconButton} onPress={handleClosePress}>
          <Ionicons name="chevron-down" size={22} color={colors.surface} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.headerTitle, { color: colors.surface }]}>
            {call.type === "video" ? "Video call" : "Voice call"}
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.tabInactive }]}>
            {callStatusText}
          </Text>
        </View>
        {isUpdatingCall ? <ActivityIndicator color={colors.surface} /> : <View style={styles.loaderSpacer} />}
      </View>

      <View style={styles.body}>
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: "rgba(255,255,255,0.08)",
              borderColor: "rgba(255,255,255,0.12)",
            },
          ]}
        >
          <Avatar name={participant.name} profilePic={participant.profilePic} size={110} />
          <Text style={[styles.participantName, { color: colors.surface }]}>
            {participant.name}
          </Text>
          <Text style={[styles.callStatus, { color: colors.tabInactive }]}>
            {call.status === "accepted" ? formatDuration(elapsedSeconds) : callStatusText}
          </Text>

          <View
            style={[
              styles.signalCard,
              {
                backgroundColor: "rgba(255,255,255,0.08)",
              },
            ]}
          >
            <Text style={[styles.signalTitle, { color: colors.surface }]}>
              Real-time signaling
            </Text>
            <Text style={[styles.signalCopy, { color: colors.tabInactive }]}>
              Socket.io controls are synced for mute, speaker, camera, answer, and hang up.
            </Text>
            {remoteControlState ? (
              <Text style={[styles.remoteStateText, { color: colors.surface }]}>
                {participant.name} {remoteControlState.isMuted ? "muted their mic" : "is audible"}
                {call.type === "video"
                  ? remoteControlState.isVideoEnabled
                    ? " and camera is on."
                    : " and camera is off."
                  : "."}
              </Text>
            ) : null}
          </View>

          {call.type === "video" ? (
            <View
              style={[
                styles.videoPreviewShell,
                {
                  backgroundColor: "rgba(255,255,255,0.08)",
                  borderColor: "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <Ionicons
                name={isVideoEnabled ? "videocam" : "videocam-off"}
                size={24}
                color={colors.surface}
              />
              <Text style={[styles.videoPreviewLabel, { color: colors.tabInactive }]}>
                {isVideoEnabled ? "Camera ready" : "Camera paused"}
              </Text>
            </View>
          ) : null}
        </View>

        {errorMessage ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: "rgba(255,255,255,0.08)",
                borderColor: "rgba(255,255,255,0.14)",
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.surface} />
            <Text style={[styles.errorText, { color: colors.surface }]}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        {call.status === "ringing" && isIncoming ? (
          <View style={styles.incomingRow}>
            <Pressable
              onPress={() => void handleFinishCall("rejected")}
              style={[
                styles.callActionButton,
                {
                  backgroundColor: colors.danger,
                },
              ]}
            >
              <Ionicons name="close" size={22} color={colors.surface} />
              <Text style={[styles.callActionLabel, { color: colors.surface }]}>Decline</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleAccept()}
              style={[
                styles.callActionButton,
                {
                  backgroundColor: colors.accent,
                },
              ]}
            >
              <Ionicons name="call" size={22} color={colors.surface} />
              <Text style={[styles.callActionLabel, { color: colors.surface }]}>Accept</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.controlsRow}>
            <Pressable
              onPress={() => void toggleMute()}
              style={[
                styles.controlButton,
                {
                  backgroundColor: isMuted ? colors.surface : "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <Ionicons
                name={isMuted ? "mic-off" : "mic"}
                size={20}
                color={isMuted ? colors.primaryDark : colors.surface}
              />
            </Pressable>
            <Pressable
              onPress={() => void toggleSpeaker()}
              style={[
                styles.controlButton,
                {
                  backgroundColor: isSpeakerOn ? colors.surface : "rgba(255,255,255,0.12)",
                },
              ]}
            >
              <Ionicons
                name={isSpeakerOn ? "volume-high" : "volume-medium"}
                size={20}
                color={isSpeakerOn ? colors.primaryDark : colors.surface}
              />
            </Pressable>
            {call.type === "video" ? (
              <Pressable
                onPress={() => void toggleVideo()}
                style={[
                  styles.controlButton,
                  {
                    backgroundColor: isVideoEnabled
                      ? colors.surface
                      : "rgba(255,255,255,0.12)",
                  },
                ]}
              >
                <Ionicons
                  name={isVideoEnabled ? "videocam" : "videocam-off"}
                  size={20}
                  color={isVideoEnabled ? colors.primaryDark : colors.surface}
                />
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleClosePress}
              style={[
                styles.hangupButton,
                {
                  backgroundColor: colors.danger,
                },
              ]}
            >
              <Ionicons name="call" size={20} color={colors.surface} style={styles.hangupIcon} />
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdropOrbLarge: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -80,
    right: -70,
    opacity: 0.3,
  },
  backdropOrbSmall: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    left: -90,
    bottom: 60,
    opacity: 0.24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  headerIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  loaderSpacer: {
    width: 20,
  },
  body: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  heroCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
    alignItems: "center",
    gap: spacing.md,
    ...shadows.strong,
  },
  participantName: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  callStatus: {
    fontSize: 16,
    fontWeight: "700",
  },
  signalCard: {
    width: "100%",
    borderRadius: radii.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  signalTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  signalCopy: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  remoteStateText: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  videoPreviewShell: {
    width: "100%",
    minHeight: 136,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  videoPreviewLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  errorCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    justifyContent: "flex-end",
  },
  incomingRow: {
    flexDirection: "row",
    gap: spacing.md,
    justifyContent: "center",
  },
  callActionButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    ...shadows.strong,
  },
  callActionLabel: {
    fontWeight: "900",
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  controlButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
  },
  hangupButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.strong,
  },
  hangupIcon: {
    transform: [{ rotate: "135deg" }],
  },
});
