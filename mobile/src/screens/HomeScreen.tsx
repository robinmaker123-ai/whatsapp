import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Application from "expo-application";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../components/Avatar";
import { ChatListItem } from "../components/ChatListItem";
import { useAuth } from "../contexts/AuthContext";
import {
  cacheCalls,
  cacheChats,
  cacheStatuses,
  loadCachedCalls,
  loadCachedChats,
  loadCachedStatuses,
} from "../services/cacheStorage";
import {
  createCallRequest,
  createStatusRequest,
  extractApiError,
  fetchCalls,
  fetchChats,
  fetchLatestRelease,
  fetchStatusFeed,
  markStatusViewedRequest,
  syncMatchedContactsRequest,
  uploadMedia,
  updateChatPreferences,
} from "../services/api";
import { socketService } from "../services/socketService";
import { radii, shadows, spacing, useAppTheme } from "../theme";
import type {
  AppRelease,
  CallRecord,
  ChatSummary,
  InviteCandidate,
  StatusFeedEntry,
  User,
  UserPresencePayload,
} from "../types/models";
import type { HomeScreenProps } from "../types/navigation";
import {
  loadHashedDeviceContacts,
  requestContactsPermissionAsync,
} from "../utils/contactSync";
import {
  formatCallSubtitle,
  formatChatPreviewTime,
  formatLastSeen,
} from "../utils/format";

type HomeTab = "Chats" | "Calls" | "Updates" | "Profile";

const tabs: HomeTab[] = ["Chats", "Calls", "Updates", "Profile"];

const statusPalette = ["#128C7E", "#0B5A4F", "#D64545", "#3D8D7A", "#3E9BDC"];

const CallRow = ({
  call,
  onPress,
}: {
  call: CallRecord;
  onPress: () => void;
}) => {
  const { colors, isDark } = useAppTheme();
  const contact = call.contact;
  const accent =
    call.status === "missed" || call.status === "rejected" ? colors.danger : colors.accent;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cardRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <Avatar
        name={contact?.name || "Unknown"}
        profilePic={contact?.profilePic}
        size={54}
      />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
            {contact?.name || "Unknown"}
          </Text>
          <Text style={[styles.rowTime, { color: colors.textMuted }]}>
            {formatChatPreviewTime(call.createdAt)}
          </Text>
        </View>

        <View style={styles.callMetaRow}>
          <Ionicons
            name={
              call.direction === "incoming"
                ? "arrow-down-outline"
                : call.direction === "outgoing"
                  ? "arrow-up-outline"
                  : "close-outline"
            }
            size={16}
            color={accent}
          />
          <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
            {formatCallSubtitle(call)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const StatusRow = ({
  entry,
  onPress,
}: {
  entry: StatusFeedEntry;
  onPress: () => void;
}) => {
  const { colors } = useAppTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cardRow,
        {
          backgroundColor: colors.surface,
          borderColor: colors.cardBorder,
        },
      ]}
    >
      <View
        style={[
          styles.statusRing,
          {
            borderColor: entry.hasUnviewed ? colors.accent : colors.textMuted,
          },
        ]}
      >
        <Avatar name={entry.user.name} profilePic={entry.user.profilePic} size={50} />
      </View>

      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{entry.user.name}</Text>
        <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {entry.statuses[0]?.text || "Photo update"}
        </Text>
        <Text style={[styles.rowTime, { color: colors.textMuted }]}>
          {formatLastSeen(entry.latestStatusAt)}
        </Text>
      </View>
    </Pressable>
  );
};

export const HomeScreen = ({ navigation }: HomeScreenProps) => {
  const {
    session,
    signOut,
    refreshConnection,
    lastConnectionCheckAt,
    serverReachable,
    updateUser,
  } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [activeTab, setActiveTab] = useState<HomeTab>("Chats");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [archivedChats, setArchivedChats] = useState<ChatSummary[]>([]);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [statusFeed, setStatusFeed] = useState<{ mine: StatusFeedEntry | null; feed: StatusFeedEntry[] }>({
    mine: null,
    feed: [],
  });
  const [contacts, setContacts] = useState<User[]>([]);
  const [inviteCandidates, setInviteCandidates] = useState<InviteCandidate[]>([]);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [contactSyncMessage, setContactSyncMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingContacts, setIsSyncingContacts] = useState(false);
  const [latestRelease, setLatestRelease] = useState<AppRelease | null>(null);
  const [isComposerVisible, setIsComposerVisible] = useState(false);
  const [composerMode, setComposerMode] = useState<"chat" | "call">("chat");
  const [contactsQuery, setContactsQuery] = useState("");
  const [isStatusComposerVisible, setIsStatusComposerVisible] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusColor, setStatusColor] = useState(statusPalette[0]);
  const [isPublishingStatus, setIsPublishingStatus] = useState(false);
  const indicatorTranslate = useRef(new Animated.Value(0)).current;
  const hasAttemptedContactSyncRef = useRef(false);
  const tabWidth = (width - spacing.xxl * 2 - spacing.md) / tabs.length;

  const token = session?.token;
  const currentUser = session?.user;
  const currentBuildNumber = Number(Application.nativeBuildVersion || 0) || 0;
  const currentVersionLabel = Application.nativeApplicationVersion || "Expo preview";
  const hasAvailableUpdate = Boolean(
    latestRelease && currentBuildNumber > 0 && latestRelease.buildNumber > currentBuildNumber
  );

  useEffect(() => {
    void loadCachedChats().then(setChats);
    void loadCachedCalls().then(setCalls);
    void loadCachedStatuses().then(setStatusFeed);
  }, []);

  const syncDeviceContacts = useCallback(
    async (source: "auto" | "manual" = "manual") => {
      if (!token || !currentUser) {
        return;
      }

      setIsSyncingContacts(true);

      try {
        const permission = await requestContactsPermissionAsync();

        if (permission.status !== "granted") {
          setContactSyncMessage(
            source === "auto"
              ? "Allow contacts access to find people you know and build private invite suggestions."
              : "Contacts permission is required before we can match your address book."
          );
          return;
        }

        const hashedContacts = await loadHashedDeviceContacts();

        if (hashedContacts.length === 0) {
          setContacts([]);
          setInviteCandidates([]);
          setContactSyncMessage("No phone contacts with valid numbers were found on this device.");
          return;
        }

        const response = await syncMatchedContactsRequest(token, hashedContacts);

        setContacts(response.users);
        setInviteCandidates(response.inviteCandidates);
        setContactSyncMessage(
          `Matched ${response.matchedCount} people on VideoApp from ${response.syncedCount} saved numbers.`
        );
        updateUser({
          ...currentUser,
          matchedContactIds: response.users.map((user) => user.id),
          contactSync: {
            lastSyncedAt: response.syncedAt || new Date().toISOString(),
            syncedCount: response.syncedCount,
            matchedCount: response.matchedCount,
          },
        });
      } catch (error) {
        setBannerMessage(extractApiError(error));
      } finally {
        setIsSyncingContacts(false);
      }
    },
    [currentUser, token, updateUser]
  );

  const loadLatestRelease = useCallback(async () => {
    try {
      const release = await fetchLatestRelease();
      setLatestRelease(release);
    } catch (error) {
      const statusCode = (error as { response?: { status?: number } } | null)?.response?.status;

      if (statusCode !== 404) {
        setBannerMessage((currentMessage) => currentMessage || extractApiError(error));
      }
    }
  }, []);

  useEffect(() => {
    void loadLatestRelease();
  }, [loadLatestRelease]);

  useEffect(() => {
    if (!token || !currentUser || hasAttemptedContactSyncRef.current) {
      return;
    }

    hasAttemptedContactSyncRef.current = true;
    void syncDeviceContacts("auto");
  }, [currentUser, syncDeviceContacts, token]);

  const loadRealtimeData = useCallback(async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);

    try {
      const [nextChats, nextArchived, nextCalls, nextStatuses] = await Promise.all([
        fetchChats(token),
        fetchChats(token, { archived: true }),
        fetchCalls(token),
        fetchStatusFeed(token),
      ]);

      setChats(nextChats);
      setArchivedChats(nextArchived);
      setCalls(nextCalls);
      setStatusFeed(nextStatuses);
      setBannerMessage(serverReachable ? null : "Connected to cached data.");
      void cacheChats(nextChats);
      void cacheCalls(nextCalls);
      void cacheStatuses(nextStatuses);
    } catch (error) {
      setBannerMessage(extractApiError(error));
    } finally {
      setIsLoading(false);
    }
  }, [serverReachable, token]);

  useEffect(() => {
    void loadRealtimeData();
  }, [loadRealtimeData]);

  useEffect(() => {
    Animated.timing(indicatorTranslate, {
      toValue: tabs.indexOf(activeTab) * tabWidth,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeTab, indicatorTranslate, tabWidth]);

  useEffect(() => {
    if (!token || !currentUser) {
      return undefined;
    }

    const handleRefreshChats = () => {
      void loadRealtimeData();
    };

    const handleUserPresence = ({ userId, status, lastSeen }: UserPresencePayload) => {
      setChats((currentChats) =>
        currentChats.map((chat) =>
          chat.user.id === userId
            ? {
                ...chat,
                user: {
                  ...chat.user,
                  status,
                  lastSeen: lastSeen ?? chat.user.lastSeen,
                },
              }
            : chat
        )
      );
    };

    const handleIncomingCall = (call: CallRecord) => {
      if (!call.contact) {
        return;
      }

      navigation.navigate("Call", {
        call,
        participant: call.contact,
        isIncoming: true,
      });
    };

    const handleStatusCreated = () => {
      void loadRealtimeData();
    };

    socketService.onReceiveMessage(handleRefreshChats);
    socketService.onMessageSeen(handleRefreshChats);
    socketService.onCallUpdated(handleRefreshChats);
    socketService.onIncomingCall(handleIncomingCall);
    socketService.onStatusCreated(handleStatusCreated);
    socketService.onUserOnline(handleUserPresence);
    socketService.onUserOffline(handleUserPresence);

    return () => {
      socketService.offReceiveMessage(handleRefreshChats);
      socketService.offMessageSeen(handleRefreshChats);
      socketService.offCallUpdated(handleRefreshChats);
      socketService.offIncomingCall(handleIncomingCall);
      socketService.offStatusCreated(handleStatusCreated);
      socketService.offUserOnline(handleUserPresence);
      socketService.offUserOffline(handleUserPresence);
    };
  }, [currentUser, loadRealtimeData, navigation, token]);

  const filteredChats = useMemo(() => {
    const source = chats;
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return source;
    }

    return source.filter((chat) => {
      const haystack = [
        chat.user.name,
        chat.user.phone,
        chat.user.about || "",
        chat.lastMessage?.text || "",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [chats, searchQuery]);

  const filteredCalls = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return calls;
    }

    return calls.filter((call) =>
      (call.contact?.name || "").toLowerCase().includes(normalizedQuery)
    );
  }, [calls, searchQuery]);

  const filteredStatuses = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return statusFeed.feed;
    }

    return statusFeed.feed.filter((entry) =>
      entry.user.name.toLowerCase().includes(normalizedQuery)
    );
  }, [searchQuery, statusFeed.feed]);

  const filteredContacts = useMemo(() => {
    const normalizedQuery = contactsQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return contacts;
    }

    return contacts.filter((contact) => {
      const haystack = [contact.name, contact.phone, contact.about || ""]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [contacts, contactsQuery]);

  const filteredInviteCandidates = useMemo(() => {
    const normalizedQuery = contactsQuery.trim().toLowerCase();

    if (!normalizedQuery) {
      return inviteCandidates;
    }

    return inviteCandidates.filter((candidate) =>
      [candidate.displayName, candidate.phone]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [contactsQuery, inviteCandidates]);

  const contactSyncSummary = useMemo(() => {
    if (isSyncingContacts) {
      return "Reading your phone contacts, hashing numbers locally, and matching them securely.";
    }

    if (contactSyncMessage) {
      return contactSyncMessage;
    }

    if (currentUser?.contactSync?.lastSyncedAt) {
      const lastSyncedAt = new Date(currentUser.contactSync.lastSyncedAt).toLocaleString();
      return `Last synced ${lastSyncedAt}. ${currentUser.contactSync.matchedCount} matched contacts found from ${currentUser.contactSync.syncedCount} saved numbers.`;
    }

    return "Allow contacts access to see which people you know are already using VideoApp.";
  }, [contactSyncMessage, currentUser?.contactSync, isSyncingContacts]);

  const openComposer = useCallback(
    async (mode: "chat" | "call") => {
      setComposerMode(mode);
      setIsComposerVisible(true);

      if (contacts.length === 0 && !isSyncingContacts) {
        try {
          await syncDeviceContacts("manual");
        } catch (error) {
          setBannerMessage(extractApiError(error));
        }
      }
    },
    [contacts.length, isSyncingContacts, syncDeviceContacts]
  );

  const handleOpenChat = useCallback(
    (participant: User) => {
      setIsComposerVisible(false);
      navigation.navigate("Chat", { participant });
    },
    [navigation]
  );

  const handleToggleChatPreference = useCallback(
    async (chat: ChatSummary, payload: { isPinned?: boolean; isArchived?: boolean }) => {
      if (!token) {
        return;
      }

      try {
        await updateChatPreferences(token, chat.user.id, payload);
        await loadRealtimeData();
      } catch (error) {
        setBannerMessage(extractApiError(error));
      }
    },
    [loadRealtimeData, token]
  );

  const handleChatLongPress = useCallback(
    (chat: ChatSummary) => {
      Alert.alert(chat.user.name, "Choose an action", [
        {
          text: chat.isPinned ? "Unpin chat" : "Pin chat",
          onPress: () =>
            void handleToggleChatPreference(chat, { isPinned: !chat.isPinned }),
        },
        {
          text: chat.isArchived ? "Unarchive chat" : "Archive chat",
          onPress: () =>
            void handleToggleChatPreference(chat, { isArchived: !chat.isArchived }),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [handleToggleChatPreference]
  );

  const startCallWithUser = useCallback(
    async (contact: User, type: CallRecord["type"]) => {
      if (!token) {
        return;
      }

      try {
        const call = await createCallRequest(token, contact.id, type);
        setIsComposerVisible(false);
        navigation.navigate("Call", {
          call,
          participant: contact,
        });
      } catch (error) {
        setBannerMessage(extractApiError(error));
      }
    },
    [navigation, token]
  );

  const handlePublishTextStatus = useCallback(async () => {
    if (!token) {
      return;
    }

    if (!statusText.trim()) {
      Alert.alert("Status required", "Write something or add an image first.");
      return;
    }

    setIsPublishingStatus(true);

    try {
      await createStatusRequest(token, {
        type: "text",
        text: statusText.trim(),
        backgroundColor: statusColor,
      });
      setStatusText("");
      setIsStatusComposerVisible(false);
      await loadRealtimeData();
    } catch (error) {
      setBannerMessage(extractApiError(error));
    } finally {
      setIsPublishingStatus(false);
    }
  }, [loadRealtimeData, statusColor, statusText, token]);

  const handlePickStatusImage = useCallback(async () => {
    if (!token) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Allow gallery access to upload a status.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    try {
      setIsPublishingStatus(true);
      const asset = result.assets[0];
      const upload = await uploadMedia(token, {
        uri: asset.uri,
        fileName: asset.fileName || `status-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
        messageType: "image",
      });

      await createStatusRequest(token, {
        type: "image",
        text: statusText.trim() || "",
        mediaUrl: upload.url,
        mediaName: upload.fileName,
        mediaMimeType: upload.mimeType,
      });
      setStatusText("");
      setIsStatusComposerVisible(false);
      await loadRealtimeData();
    } catch (error) {
      setBannerMessage(extractApiError(error));
    } finally {
      setIsPublishingStatus(false);
    }
  }, [loadRealtimeData, statusText, token]);

  const handleOpenStatus = useCallback(
    async (entry: StatusFeedEntry) => {
      if (token) {
        await Promise.all(
          entry.statuses.map((status) => markStatusViewedRequest(token, status.id))
        );
      }

      navigation.navigate("StatusViewer", { entry, initialIndex: 0 });
    },
    [navigation, token]
  );

  const handleMenuPress = () => {
    Alert.alert("Menu", "Quick actions", [
      { text: "Refresh", onPress: () => void loadRealtimeData() },
      { text: "Sync contacts", onPress: () => void syncDeviceContacts("manual") },
      { text: "Settings", onPress: () => navigation.navigate("Settings") },
      { text: "Logout", style: "destructive", onPress: () => void signOut() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleInviteContact = useCallback(async (candidate: InviteCandidate) => {
    try {
      await Share.share({
        message: candidate.inviteMessage,
      });
    } catch (error) {
      setBannerMessage(error instanceof Error ? error.message : "Unable to share the invite.");
    }
  }, []);

  const handleOpenLatestRelease = useCallback(async () => {
    if (!latestRelease?.downloadUrl) {
      return;
    }

    try {
      await Linking.openURL(latestRelease.downloadUrl);
    } catch (error) {
      setBannerMessage("Could not open the latest APK download link.");
    }
  }, [latestRelease?.downloadUrl]);

  if (!session || !currentUser) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.screen }]}>
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.header,
            paddingTop: insets.top + spacing.lg,
          },
        ]}
      >
        <View
          style={[
            styles.headerOrbLarge,
            {
              backgroundColor: colors.headerAccent,
            },
          ]}
        />
        <View
          style={[
            styles.headerOrbSmall,
            {
              backgroundColor: colors.primary,
            },
          ]}
        />

        <View style={styles.headerTopRow}>
          <View style={styles.brandRow}>
            <View
              style={[
                styles.logoBubble,
                {
                  backgroundColor: "rgba(255,255,255,0.14)",
                },
              ]}
            >
              <MaterialCommunityIcons
                name="message-processing"
                size={20}
                color={colors.surface}
              />
            </View>
            <View>
              <Text style={[styles.brandName, { color: colors.surface }]}>VideoApp</Text>
              <Text style={[styles.brandTag, { color: colors.tabInactive }]}>
                {serverReachable ? "LAN backend live" : "Reconnect to your backend"}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={[styles.headerIconButton, { backgroundColor: "rgba(255,255,255,0.12)" }]}
              onPress={() => setIsSearchOpen((current) => !current)}
            >
              <Ionicons name="search-outline" size={20} color={colors.surface} />
            </Pressable>
            <Pressable
              style={[styles.headerIconButton, { backgroundColor: "rgba(255,255,255,0.12)" }]}
              onPress={() => setIsStatusComposerVisible(true)}
            >
              <Ionicons name="camera-outline" size={20} color={colors.surface} />
            </Pressable>
            <Pressable
              style={[styles.headerIconButton, { backgroundColor: "rgba(255,255,255,0.12)" }]}
              onPress={handleMenuPress}
            >
              <Ionicons name="ellipsis-vertical" size={18} color={colors.surface} />
            </Pressable>
          </View>
        </View>

        {isSearchOpen ? (
          <View style={styles.headerSearchWrap}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search chats, calls, updates"
              placeholderTextColor={colors.tabInactive}
              style={[
                styles.headerSearchInput,
                {
                  color: colors.surface,
                  borderColor: "rgba(255,255,255,0.18)",
                  backgroundColor: "rgba(255,255,255,0.08)",
                },
              ]}
            />
          </View>
        ) : null}

        <View
          style={[
            styles.tabBar,
            {
              backgroundColor: "rgba(255,255,255,0.12)",
            },
          ]}
        >
          <Animated.View
            style={[
              styles.tabIndicator,
              {
                backgroundColor: colors.surface,
                width: tabWidth,
                transform: [{ translateX: indicatorTranslate }],
              },
            ]}
          />

          {tabs.map((tab) => {
            const isActive = activeTab === tab;

            return (
              <Pressable key={tab} style={styles.tabButton} onPress={() => setActiveTab(tab)}>
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color: isActive ? colors.header : colors.tabInactive,
                    },
                  ]}
                >
                  {tab}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {bannerMessage ? (
        <View
          style={[
            styles.bannerCard,
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

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + spacing.xxxl + 88,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "Chats" ? (
          <View style={styles.sectionStack}>
            <View
              style={[
                styles.heroCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={styles.heroTopRow}>
                <View style={styles.heroCopyWrap}>
                  <Text style={[styles.heroEyebrow, { color: colors.primary }]}>Chats</Text>
                  <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                    Real conversations with the people already in your contacts.
                  </Text>
                  <Text style={[styles.heroCopy, { color: colors.textSecondary }]}>
                    Chats, presence, and contact matching are backed by MongoDB, Socket.io, and
                    private local contact hashing.
                  </Text>
                </View>
                <View
                  style={[
                    styles.heroPill,
                    {
                      backgroundColor: serverReachable ? colors.accentSoft : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.heroPillText, { color: colors.primaryDark }]}>
                    {serverReachable ? "Live" : "Cached"}
                  </Text>
                </View>
              </View>

              <Pressable
                style={[
                  styles.archiveCard,
                  {
                    backgroundColor: colors.surfaceMuted,
                  },
                ]}
                onPress={() =>
                  Alert.alert(
                    "Archived chats",
                    archivedChats.length
                      ? archivedChats.map((chat) => chat.user.name).join(", ")
                      : "No archived chats yet."
                  )
                }
              >
                <Ionicons name="archive-outline" size={18} color={colors.primaryDark} />
                <Text style={[styles.archiveLabel, { color: colors.textPrimary }]}>
                  Archived chats
                </Text>
                <Text style={[styles.archiveCount, { color: colors.textSecondary }]}>
                  {archivedChats.length}
                </Text>
              </Pressable>
            </View>

            <View
              style={[
                styles.sectionIntro,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                  Contact sync
                </Text>
                {isSyncingContacts ? <ActivityIndicator color={colors.primary} size="small" /> : null}
              </View>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {contactSyncSummary}
              </Text>
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => void syncDeviceContacts("manual")}
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  disabled={isSyncingContacts}
                >
                  {isSyncingContacts ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={[styles.primaryButtonLabel, { color: colors.surface }]}>
                      Sync contacts
                    </Text>
                  )}
                </Pressable>
                {hasAvailableUpdate ? (
                  <Pressable
                    onPress={() => void handleOpenLatestRelease()}
                    style={[styles.secondaryButton, { borderColor: colors.cardBorder }]}
                  >
                    <Text style={[styles.secondaryButtonLabel, { color: colors.textPrimary }]}>
                      Update app
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {isLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.loadingLabel, { color: colors.textSecondary }]}>
                  Loading chats...
                </Text>
              </View>
            ) : null}

            {filteredChats.map((chat) => (
              <ChatListItem
                key={chat.user.id}
                chat={chat}
                currentUserId={currentUser.id}
                onPress={() => navigation.navigate("Chat", { participant: chat.user })}
                onLongPress={() => handleChatLongPress(chat)}
              />
            ))}
          </View>
        ) : null}

        {activeTab === "Calls" ? (
          <View style={styles.sectionStack}>
            <View
              style={[
                styles.sectionIntro,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Recent calls</Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                Call history is stored on the backend and updates live when calls ring, connect,
                or end.
              </Text>
            </View>

            {filteredCalls.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                onPress={() => call.contact && void startCallWithUser(call.contact, call.type)}
              />
            ))}
          </View>
        ) : null}

        {activeTab === "Updates" ? (
          <View style={styles.sectionStack}>
            <Pressable
              style={[
                styles.myStatusCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
              onPress={() => setIsStatusComposerVisible(true)}
            >
              <View
                style={[
                  styles.myStatusAccent,
                  {
                    backgroundColor: colors.accentSoft,
                  },
                ]}
              >
                <Avatar name={currentUser.name} profilePic={currentUser.profilePic} size={56} />
              </View>

              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>My status</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {statusFeed.mine?.statuses[0]?.text || "Tap to post a text or photo update"}
                </Text>
              </View>

              <View
                style={[
                  styles.addStatusButton,
                  {
                    backgroundColor: colors.primary,
                  },
                ]}
              >
                <Ionicons name="add" size={18} color={colors.surface} />
              </View>
            </Pressable>

            {filteredStatuses.map((entry) => (
              <StatusRow key={entry.user.id} entry={entry} onPress={() => void handleOpenStatus(entry)} />
            ))}
          </View>
        ) : null}

        {activeTab === "Profile" ? (
          <View style={styles.sectionStack}>
            <View
              style={[
                styles.profileHero,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View
                style={[
                  styles.profileGlow,
                  {
                    backgroundColor: isDark ? colors.headerAccent : colors.accentSoft,
                  },
                ]}
              />
              <Avatar name={currentUser.name} profilePic={currentUser.profilePic} size={76} />
              <Text style={[styles.profileName, { color: colors.textPrimary }]}>
                {currentUser.name}
              </Text>
              <Text style={[styles.profileAbout, { color: colors.textSecondary }]}>
                {currentUser.about || "Hey there! I am using VideoApp."}
              </Text>

              <View style={styles.profileStats}>
                <View style={[styles.profileStatCard, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.profileStatNumber, { color: colors.textPrimary }]}>
                    {chats.length}
                  </Text>
                  <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>
                    Active chats
                  </Text>
                </View>
                <View style={[styles.profileStatCard, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.profileStatNumber, { color: colors.textPrimary }]}>
                    {calls.length}
                  </Text>
                  <Text style={[styles.profileStatLabel, { color: colors.textSecondary }]}>
                    Calls
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => void syncDeviceContacts("manual")}
              style={[
                styles.profileRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={[styles.profileIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="people-outline" size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Matched contacts</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {currentUser.contactSync?.matchedCount || contacts.length} contacts are ready for
                  chat and calls.
                </Text>
              </View>
              {isSyncingContacts ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Ionicons name="refresh" size={18} color={colors.textMuted} />
              )}
            </Pressable>

            <View
              style={[
                styles.sectionIntro,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Connection</Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                {serverReachable ? "Connected to your LAN backend" : "Backend unavailable"}
              </Text>
              <Text style={[styles.sectionDescription, { color: colors.textSecondary }]}>
                Last server check:{" "}
                {lastConnectionCheckAt
                  ? new Date(lastConnectionCheckAt).toLocaleTimeString()
                  : "pending"}
              </Text>
            </View>

            <Pressable
              onPress={() => void handleOpenLatestRelease()}
              style={[
                styles.profileRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                  opacity: latestRelease ? 1 : 0.72,
                },
              ]}
              disabled={!latestRelease?.downloadUrl}
            >
              <View style={[styles.profileIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons
                  name={hasAvailableUpdate ? "download-outline" : "phone-portrait-outline"}
                  size={20}
                  color={colors.primaryDark}
                />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                  Android release
                </Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {latestRelease
                    ? hasAvailableUpdate
                      ? `Version ${latestRelease.version} is ready to install.`
                      : `Current app version ${currentVersionLabel} is up to date.`
                    : "No published Android release detected yet."}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Settings")}
              style={[
                styles.profileRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={[styles.profileIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="settings-outline" size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Settings</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Privacy, notifications, theme, blocked contacts
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <Pressable
              onPress={() => void refreshConnection()}
              style={[
                styles.profileRow,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <View style={[styles.profileIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="refresh-outline" size={20} color={colors.primaryDark} />
              </View>
              <View style={styles.rowBody}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Retry backend</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  Refresh auth, chats, status, and socket connection
                </Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => void signOut()}
              style={[
                styles.logoutButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.cardBorder,
                },
              ]}
            >
              <Ionicons name="log-out-outline" size={18} color={colors.danger} />
              <Text style={[styles.logoutLabel, { color: colors.danger }]}>Logout</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: activeTab === "Calls" ? colors.primaryDark : colors.fab,
            bottom: insets.bottom + spacing.lg,
          },
        ]}
        onPress={() => void openComposer(activeTab === "Calls" ? "call" : "chat")}
      >
        <Ionicons
          name={activeTab === "Calls" ? "call" : "chatbubble-ellipses"}
          size={22}
          color={colors.surface}
        />
      </Pressable>

      <Modal
        visible={isComposerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsComposerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setIsComposerVisible(false)} />

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
                {composerMode === "chat" ? "New chat" : "Start call"}
              </Text>
              <Pressable
                onPress={() => setIsComposerVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>

            <TextInput
              value={contactsQuery}
              onChangeText={setContactsQuery}
              placeholder="Search synced contacts"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.textPrimary,
                },
              ]}
            />

            <ScrollView
              style={styles.contactList}
              contentContainerStyle={styles.composerListContent}
              keyboardShouldPersistTaps={"handled"}
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.composerSectionTitle, { color: colors.textPrimary }]}>
                On VideoApp
              </Text>

              {filteredContacts.map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    composerMode === "chat"
                      ? handleOpenChat(item)
                      : void startCallWithUser(item, "voice")
                  }
                  style={[
                    styles.contactRow,
                    {
                      borderBottomColor: colors.cardBorder,
                    },
                  ]}
                >
                  <Avatar name={item.name} profilePic={item.profilePic} size={52} />
                  <View style={styles.contactBody}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                      <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                        {item.status === "online" ? "Online" : formatLastSeen(item.lastSeen)}
                      </Text>
                    </View>
                    <Text
                      style={[styles.rowSubtitle, { color: colors.textSecondary }]}
                      numberOfLines={1}
                    >
                      {item.about || item.phone}
                    </Text>
                  </View>
                </Pressable>
              ))}

              {filteredContacts.length === 0 ? (
                <View style={styles.emptyComposerState}>
                  <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
                    No synced contacts found
                  </Text>
                  <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                    Sync your phone contacts to start chats and calls with people already using the
                    app.
                  </Text>
                </View>
              ) : null}

              {composerMode === "chat" && filteredInviteCandidates.length > 0 ? (
                <View style={styles.inviteSection}>
                  <Text style={[styles.composerSectionTitle, { color: colors.textPrimary }]}>
                    Invite contacts
                  </Text>

                  {filteredInviteCandidates.map((candidate) => (
                    <View
                      key={candidate.hash}
                      style={[
                        styles.contactRow,
                        {
                          borderBottomColor: colors.cardBorder,
                        },
                      ]}
                    >
                      <View style={styles.contactBody}>
                        <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                          {candidate.displayName}
                        </Text>
                        <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                          {candidate.phone}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => void handleInviteContact(candidate)}
                        style={[styles.inviteButton, { backgroundColor: colors.primary }]}
                      >
                        <Text style={[styles.inviteButtonLabel, { color: colors.surface }]}>
                          Invite
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isStatusComposerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsStatusComposerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setIsStatusComposerVisible(false)}
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
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Create status</Text>
              <Pressable
                onPress={() => setIsStatusComposerVisible(false)}
                style={[styles.closeButton, { backgroundColor: colors.surfaceMuted }]}
              >
                <Ionicons name="close" size={18} color={colors.textPrimary} />
              </Pressable>
            </View>
            <TextInput
              value={statusText}
              onChangeText={setStatusText}
              placeholder="Write a status"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                styles.statusInput,
                {
                  backgroundColor: statusColor,
                  color: colors.surface,
                },
              ]}
            />
            <View style={styles.statusPaletteRow}>
              {statusPalette.map((colorValue) => (
                <Pressable
                  key={colorValue}
                  onPress={() => setStatusColor(colorValue)}
                  style={[
                    styles.paletteDot,
                    {
                      backgroundColor: colorValue,
                      borderColor:
                        statusColor === colorValue ? colors.textPrimary : "transparent",
                    },
                  ]}
                />
              ))}
            </View>
            <View style={styles.buttonRow}>
              <Pressable
                onPress={() => void handlePickStatusImage()}
                style={[styles.secondaryButton, { borderColor: colors.cardBorder }]}
              >
                <Text style={[styles.secondaryButtonLabel, { color: colors.textPrimary }]}>
                  Photo status
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handlePublishTextStatus()}
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                disabled={isPublishingStatus}
              >
                {isPublishingStatus ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={[styles.primaryButtonLabel, { color: colors.surface }]}>
                    Post
                  </Text>
                )}
              </Pressable>
            </View>
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
    position: "relative",
    overflow: "hidden",
    paddingBottom: spacing.md,
  },
  headerOrbLarge: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    right: -48,
    top: -32,
    opacity: 0.35,
  },
  headerOrbSmall: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    left: -30,
    bottom: -26,
    opacity: 0.35,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xxl,
    gap: spacing.md,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },
  logoBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  brandTag: {
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  headerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSearchWrap: {
    paddingHorizontal: spacing.xxl,
    marginTop: spacing.md,
  },
  headerSearchInput: {
    borderRadius: radii.full,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  tabBar: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.xxl,
    borderRadius: radii.full,
    position: "relative",
    flexDirection: "row",
    overflow: "hidden",
  },
  tabIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    borderRadius: radii.full,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  bannerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sectionStack: {
    gap: spacing.md,
  },
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroCopyWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
  },
  heroCopy: {
    fontSize: 14,
    lineHeight: 21,
  },
  heroPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  heroPillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  archiveCard: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  archiveLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  archiveCount: {
    fontSize: 13,
  },
  loadingCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  loadingLabel: {
    fontSize: 13,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    ...shadows.soft,
  },
  rowBody: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xs,
  },
  rowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  rowTime: {
    fontSize: 12,
  },
  callMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusRing: {
    padding: 3,
    borderRadius: 30,
    borderWidth: 2,
  },
  sectionIntro: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.xs,
    ...shadows.soft,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 19,
  },
  myStatusCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    ...shadows.soft,
  },
  myStatusAccent: {
    width: 70,
    height: 70,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  addStatusButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  profileHero: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
    overflow: "hidden",
    ...shadows.soft,
  },
  profileGlow: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -110,
    right: -70,
    opacity: 0.3,
  },
  profileName: {
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  profileAbout: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 300,
  },
  profileStats: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  profileStatCard: {
    flex: 1,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 2,
  },
  profileStatNumber: {
    fontSize: 20,
    fontWeight: "900",
  },
  profileStatLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    ...shadows.soft,
  },
  profileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    paddingVertical: spacing.md,
    ...shadows.soft,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: "900",
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.strong,
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
  searchInput: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  composerListContent: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  composerSectionTitle: {
    fontSize: 14,
    fontWeight: "900",
  },
  contactList: {
    flexGrow: 0,
  },
  inviteSection: {
    gap: spacing.sm,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  contactBody: {
    flex: 1,
    gap: 2,
  },
  inviteButton: {
    minWidth: 88,
    minHeight: 40,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
  },
  inviteButtonLabel: {
    fontWeight: "800",
  },
  emptyComposerState: {
    paddingVertical: spacing.xl,
    alignItems: "center",
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  emptySubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  statusInput: {
    minHeight: 160,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    textAlignVertical: "top",
    fontSize: 18,
    fontWeight: "700",
  },
  statusPaletteRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  paletteDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    flex: 1,
  },
  primaryButtonLabel: {
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    flex: 1,
  },
  secondaryButtonLabel: {
    fontWeight: "800",
  },
});
