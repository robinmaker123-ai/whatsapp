import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "../components/Avatar";
import { useAuth } from "../contexts/AuthContext";
import {
  extractApiError,
  fetchMatchedContacts,
  updateBlockedContact,
  updateProfile,
  updateSettings,
  uploadMedia,
} from "../services/api";
import { radii, shadows, spacing, useAppTheme } from "../theme";
import type {
  SettingsScreenProps,
} from "../types/navigation";
import type {
  ThemePreference,
  User,
  UserNotifications,
  UserPrivacy,
} from "../types/models";

type PrivacyKey = keyof UserPrivacy;
type NotificationKey = keyof UserNotifications;
type VisibilityOption = UserPrivacy["lastSeenVisibility"];

const themeOptions: ThemePreference[] = ["system", "light", "dark"];
const visibilityOptions: VisibilityOption[] = ["everyone", "contacts", "nobody"];

const prettify = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/([A-Z])/g, " $1");

const defaultPrivacy: UserPrivacy = {
  readReceipts: true,
  lastSeenVisibility: "everyone",
  statusVisibility: "contacts",
  profilePhotoVisibility: "everyone",
};

const defaultNotifications: UserNotifications = {
  messagePreview: true,
  callAlerts: true,
  vibrate: true,
};

export const SettingsScreen = ({ navigation }: SettingsScreenProps) => {
  const { session, signOut, updateUser } = useAuth();
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(session?.user.name || "");
  const [about, setAbout] = useState(session?.user.about || "");
  const [themePreference, setThemePreference] = useState<ThemePreference>(
    session?.user.themePreference || "system"
  );
  const [privacy, setPrivacy] = useState<UserPrivacy>(
    session?.user.privacy || defaultPrivacy
  );
  const [notifications, setNotifications] = useState<UserNotifications>(
    session?.user.notifications || defaultNotifications
  );
  const [profilePhotoUri, setProfilePhotoUri] = useState(session?.user.profilePic || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contacts, setContacts] = useState<User[]>([]);
  const [activeBlockUserId, setActiveBlockUserId] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = session?.token || "";
  const blockedContactSet = useMemo(
    () => new Set(session?.user.blockedContacts || []),
    [session?.user.blockedContacts]
  );

  useEffect(() => {
    if (!token) {
      return;
    }

    let isMounted = true;

    const loadContacts = async () => {
      setIsLoadingContacts(true);

      try {
        const response = await fetchMatchedContacts(token);

        if (isMounted) {
          setContacts(response.users);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(extractApiError(error));
        }
      } finally {
        if (isMounted) {
          setIsLoadingContacts(false);
        }
      }
    };

    void loadContacts();

    return () => {
      isMounted = false;
    };
  }, [token]);

  if (!session) {
    return null;
  }

  const handlePickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Allow gallery access to update your profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.82,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    setProfilePhotoUri(result.assets[0].uri);
  };

  const handleSave = async () => {
    if (!token) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      let nextUser = session.user;
      let uploadedProfilePic = "";

      if (profilePhotoUri && profilePhotoUri !== session.user.profilePic) {
        const upload = await uploadMedia(token, {
          uri: profilePhotoUri,
          fileName: `profile-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          messageType: "image",
        });
        uploadedProfilePic = upload.url;
      }

      const profileNeedsUpdate =
        name.trim() !== (session.user.name || "") ||
        about.trim() !== (session.user.about || "") ||
        Boolean(uploadedProfilePic);

      if (profileNeedsUpdate) {
        nextUser = await updateProfile(token, {
          name: name.trim() || undefined,
          about: about.trim() || undefined,
          profilePic: uploadedProfilePic || undefined,
        });
      }

      nextUser = await updateSettings(token, {
        themePreference,
        privacy,
        notifications,
      });

      updateUser(nextUser);
      setFeedbackMessage("Settings updated.");
    } catch (error) {
      setErrorMessage(extractApiError(error));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBlockedContact = async (contact: User) => {
    if (!token) {
      return;
    }

    setActiveBlockUserId(contact.id);
    setErrorMessage(null);
    setFeedbackMessage(null);

    try {
      const nextBlockedContacts = await updateBlockedContact(
        token,
        contact.id,
        !blockedContactSet.has(contact.id)
      );

      updateUser({
        ...session.user,
        blockedContacts: nextBlockedContacts,
      });
    } catch (error) {
      setErrorMessage(extractApiError(error));
    } finally {
      setActiveBlockUserId(null);
    }
  };

  const updatePrivacyValue = <T extends PrivacyKey>(
    key: T,
    value: UserPrivacy[T]
  ) => {
    setPrivacy((currentPrivacy) => ({
      ...currentPrivacy,
      [key]: value,
    }));
  };

  const updateNotificationValue = <T extends NotificationKey>(
    key: T,
    value: UserNotifications[T]
  ) => {
    setNotifications((currentNotifications) => ({
      ...currentNotifications,
      [key]: value,
    }));
  };

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
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color={colors.surface} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: colors.surface }]}>Settings</Text>
            <Text style={[styles.headerSubtitle, { color: colors.tabInactive }]}>
              Privacy, notifications, blocked contacts, and theme
            </Text>
          </View>
          <Pressable
            style={[
              styles.saveButton,
              {
                backgroundColor: isDark ? colors.primary : colors.surface,
              },
            ]}
            onPress={() => void handleSave()}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color={isDark ? colors.surface : colors.primaryDark} />
            ) : (
              <Text
                style={[
                  styles.saveButtonLabel,
                  {
                    color: isDark ? colors.surface : colors.primaryDark,
                  },
                ]}
              >
                Save
              </Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View
            style={[
              styles.feedbackCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
            <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {feedbackMessage ? (
          <View
            style={[
              styles.feedbackCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.feedbackText, { color: colors.textSecondary }]}>
              {feedbackMessage}
            </Text>
          </View>
        ) : null}

        <View
          style={[
            styles.profileCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Pressable onPress={() => void handlePickProfilePhoto()} style={styles.profileAvatarWrap}>
            <Avatar
              name={name || session.user.name}
              profilePic={profilePhotoUri || session.user.profilePic}
              size={88}
            />
            <View
              style={[
                styles.profileCameraBadge,
                {
                  backgroundColor: colors.primary,
                },
              ]}
            >
              <Ionicons name="camera" size={16} color={colors.surface} />
            </View>
          </Pressable>

          <View style={styles.profileFields}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Profile</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Display name"
              placeholderTextColor={colors.textMuted}
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.textPrimary,
                },
              ]}
            />
            <TextInput
              value={about}
              onChangeText={setAbout}
              placeholder="About"
              placeholderTextColor={colors.textMuted}
              multiline
              style={[
                styles.input,
                styles.aboutInput,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.textPrimary,
                },
              ]}
            />
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Theme</Text>
          <View style={styles.optionRow}>
            {themeOptions.map((option) => {
              const isActive = themePreference === option;

              return (
                <Pressable
                  key={option}
                  onPress={() => setThemePreference(option)}
                  style={[
                    styles.optionChip,
                    {
                      backgroundColor: isActive ? colors.primary : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionChipText,
                      {
                        color: isActive ? colors.surface : colors.textPrimary,
                      },
                    ]}
                  >
                    {prettify(option)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Privacy</Text>

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>Read receipts</Text>
              <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                Send and receive seen updates in chats.
              </Text>
            </View>
            <Switch
              value={privacy.readReceipts}
              onValueChange={(value) => updatePrivacyValue("readReceipts", value)}
              trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
              thumbColor={colors.surface}
            />
          </View>

          {(
            [
              ["lastSeenVisibility", "Last seen"],
              ["statusVisibility", "Status visibility"],
              ["profilePhotoVisibility", "Profile photo"],
            ] as Array<[PrivacyKey, string]>
          ).map(([key, label]) => (
            <View key={key} style={styles.preferenceGroup}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{label}</Text>
              <View style={styles.optionRow}>
                {visibilityOptions.map((option) => {
                  const isActive = privacy[key] === option;

                  return (
                    <Pressable
                      key={`${key}-${option}`}
                      onPress={() => updatePrivacyValue(key, option)}
                      style={[
                        styles.optionChip,
                        {
                          backgroundColor: isActive ? colors.primaryDark : colors.surfaceMuted,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          {
                            color: isActive ? colors.surface : colors.textPrimary,
                          },
                        ]}
                      >
                        {prettify(option)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Notifications</Text>
          {(
            [
              ["messagePreview", "Message preview"],
              ["callAlerts", "Call alerts"],
              ["vibrate", "Vibrate"],
            ] as Array<[NotificationKey, string]>
          ).map(([key, label]) => (
            <View key={key} style={styles.toggleRow}>
              <View style={styles.toggleCopy}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>{label}</Text>
                <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                  {key === "messagePreview"
                    ? "Show a short message preview in notifications."
                    : key === "callAlerts"
                      ? "Show alerts for incoming voice and video calls."
                      : "Vibrate when new activity comes in."}
                </Text>
              </View>
              <Switch
                value={notifications[key]}
                onValueChange={(value) => updateNotificationValue(key, value)}
                trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
                thumbColor={colors.surface}
              />
            </View>
          ))}
        </View>

        <View
          style={[
            styles.sectionCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <View style={styles.sectionTitleRow}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              Blocked contacts
            </Text>
            {isLoadingContacts ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </View>

          {contacts.length === 0 && !isLoadingContacts ? (
            <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
              No synced app contacts yet. Sync your phone contacts from the Home screen, then
              manage blocked people here.
            </Text>
          ) : null}

          {contacts.map((contact) => {
            const isBlocked = blockedContactSet.has(contact.id);
            const isUpdating = activeBlockUserId === contact.id;

            return (
              <View
                key={contact.id}
                style={[
                  styles.contactRow,
                  {
                    borderBottomColor: colors.cardBorder,
                  },
                ]}
              >
                <Avatar name={contact.name} profilePic={contact.profilePic} size={48} />
                <View style={styles.contactCopy}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                    {contact.name}
                  </Text>
                  <Text style={[styles.rowSubtitle, { color: colors.textSecondary }]}>
                    {contact.about || contact.phone}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void handleToggleBlockedContact(contact)}
                  disabled={isUpdating}
                  style={[
                    styles.blockButton,
                    {
                      backgroundColor: isBlocked ? colors.surfaceMuted : colors.primary,
                    },
                  ]}
                >
                  {isUpdating ? (
                    <ActivityIndicator
                      size="small"
                      color={isBlocked ? colors.textPrimary : colors.surface}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.blockButtonLabel,
                        {
                          color: isBlocked ? colors.textPrimary : colors.surface,
                        },
                      ]}
                    >
                      {isBlocked ? "Unblock" : "Block"}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>

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
          <Text style={[styles.logoutButtonLabel, { color: colors.danger }]}>Logout</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "900",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  saveButton: {
    minWidth: 74,
    minHeight: 38,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonLabel: {
    fontWeight: "800",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  feedbackCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    ...shadows.soft,
  },
  feedbackText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  profileCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.lg,
    ...shadows.soft,
  },
  profileAvatarWrap: {
    alignSelf: "center",
  },
  profileCameraBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  profileFields: {
    gap: spacing.md,
  },
  sectionCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.soft,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
  },
  input: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  aboutInput: {
    minHeight: 94,
    textAlignVertical: "top",
  },
  optionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  optionChip: {
    minHeight: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  optionChipText: {
    fontSize: 13,
    fontWeight: "800",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 19,
  },
  preferenceGroup: {
    gap: spacing.sm,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  contactCopy: {
    flex: 1,
    gap: 2,
  },
  blockButton: {
    minWidth: 88,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
  },
  blockButtonLabel: {
    fontWeight: "800",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radii.full,
    borderWidth: 1,
    minHeight: 54,
    ...shadows.soft,
  },
  logoutButtonLabel: {
    fontWeight: "900",
  },
});
