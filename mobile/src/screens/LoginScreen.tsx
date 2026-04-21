import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "../contexts/AuthContext";
import {
  extractApiError,
  sendOtpRequest,
  updateProfile,
  uploadMedia,
  verifyOtpRequest,
} from "../services/api";
import { radii, spacing, useAppTheme } from "../theme";

export const LoginScreen = () => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { signIn, refreshConnection, serverReachable } = useAuth();
  const [phone, setPhone] = useState("+91");
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [profilePhotoUri, setProfilePhotoUri] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handlePickProfilePhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Permission required", "Allow gallery access to set a profile photo.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    setProfilePhotoUri(result.assets[0].uri);
  };

  const requestOtp = async () => {
    const normalizedPhone = phone.trim();

    if (normalizedPhone.length < 8) {
      setErrorMessage("Enter a valid phone number.");
      return;
    }

    setIsSendingOtp(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const response = await sendOtpRequest(normalizedPhone);
      setOtpSent(true);
      setMockOtp(response.mockOtp || null);
      setSuccessMessage(
        response.mockOtp
          ? `Development OTP: ${response.mockOtp}`
          : "OTP sent successfully."
      );
    } catch (error) {
      setErrorMessage(extractApiError(error));
      await refreshConnection();
    } finally {
      setIsSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    const normalizedPhone = phone.trim();
    const normalizedOtp = otp.trim();

    if (normalizedOtp.length !== 6) {
      setErrorMessage("Enter the 6-digit OTP.");
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMessage(null);

    try {
      const session = await verifyOtpRequest(normalizedPhone, normalizedOtp, {
        name: name.trim() || undefined,
        about: about.trim() || undefined,
      });
      let nextUser = session.user;

      if (profilePhotoUri) {
        const upload = await uploadMedia(session.token, {
          uri: profilePhotoUri,
          fileName: `profile-${Date.now()}.jpg`,
          mimeType: "image/jpeg",
          messageType: "image",
        });

        nextUser = await updateProfile(session.token, {
          profilePic: upload.url,
        });
      }

      await signIn({
        ...session,
        user: nextUser,
      });
    } catch (error) {
      setErrorMessage(extractApiError(error));
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.screen }]}>
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: colors.accentSoft,
          },
        ]}
      />
      <View
        style={[
          styles.backdropSmall,
          {
            backgroundColor: colors.primary,
          },
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardWrap}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl },
          ]}
          keyboardShouldPersistTaps={"handled"}
        >
          <View style={styles.hero}>
            <Pressable
              onPress={() => void handlePickProfilePhoto()}
              style={[
                styles.heroBadge,
                {
                  backgroundColor: colors.primaryDark,
                },
              ]}
            >
              {profilePhotoUri ? (
                <Image source={{ uri: profilePhotoUri }} style={styles.profilePreview} />
              ) : (
                <Ionicons name="camera" size={24} color={colors.surface} />
              )}
            </Pressable>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Sign in to VideoApp</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Connect your Android app to the real Node, MongoDB, and Socket.io backend over LAN.
            </Text>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: colors.cardBorder,
              },
            ]}
          >
            <View
              style={[
                styles.connectionBadge,
                {
                  backgroundColor: serverReachable ? colors.accentSoft : colors.surfaceMuted,
                },
              ]}
            >
              <Text
                style={[
                  styles.connectionLabel,
                  { color: serverReachable ? colors.primaryDark : colors.textSecondary },
                ]}
              >
                {serverReachable ? "Backend connected" : "Waiting for backend"}
              </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
              OTP login
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
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
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.textPrimary,
                },
              ]}
            />
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
              style={[
                styles.input,
                {
                  backgroundColor: colors.surfaceMuted,
                  color: colors.textPrimary,
                },
              ]}
            />

            {otpSent ? (
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="Enter 6-digit OTP"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceMuted,
                    color: colors.textPrimary,
                  },
                ]}
              />
            ) : null}

            {mockOtp ? (
              <View
                style={[
                  styles.mockOtpCard,
                  {
                    backgroundColor: colors.accentSoft,
                  },
                ]}
              >
                <Text style={[styles.mockOtpLabel, { color: colors.primaryDark }]}>
                  Development OTP
                </Text>
                <Text style={[styles.mockOtpValue, { color: colors.primaryDark }]}>
                  {mockOtp}
                </Text>
              </View>
            ) : null}

            {errorMessage ? (
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            ) : null}
            {successMessage ? (
              <Text style={[styles.successText, { color: colors.primary }]}>{successMessage}</Text>
            ) : null}

            {!otpSent ? (
              <Pressable
                onPress={() => void requestOtp()}
                disabled={isSendingOtp}
                style={[
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                  },
                  isSendingOtp && styles.buttonDisabled,
                ]}
              >
                {isSendingOtp ? (
                  <ActivityIndicator color={colors.surface} />
                ) : (
                  <Text style={[styles.primaryButtonLabel, { color: colors.surface }]}>
                    Send OTP
                  </Text>
                )}
              </Pressable>
            ) : (
              <View style={styles.buttonRow}>
                <Pressable
                  onPress={() => void requestOtp()}
                  disabled={isSendingOtp}
                  style={[
                    styles.secondaryButton,
                    {
                      borderColor: colors.cardBorder,
                    },
                    isSendingOtp && styles.buttonDisabled,
                  ]}
                >
                  <Text style={[styles.secondaryButtonLabel, { color: colors.textPrimary }]}>
                    Resend
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => void verifyOtp()}
                  disabled={isVerifyingOtp}
                  style={[
                    styles.primaryButton,
                    {
                      backgroundColor: colors.primary,
                    },
                    isVerifyingOtp && styles.buttonDisabled,
                  ]}
                >
                  {isVerifyingOtp ? (
                    <ActivityIndicator color={colors.surface} />
                  ) : (
                    <Text style={[styles.primaryButtonLabel, { color: colors.surface }]}>
                      Verify OTP
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  backdrop: {
    position: "absolute",
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.44,
  },
  backdropSmall: {
    position: "absolute",
    left: -90,
    bottom: 120,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.24,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
    gap: spacing.xl,
  },
  hero: {
    alignItems: "center",
    gap: spacing.sm,
  },
  heroBadge: {
    width: 74,
    height: 74,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  profilePreview: {
    width: "100%",
    height: "100%",
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 340,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  connectionBadge: {
    alignSelf: "flex-start",
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  connectionLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  input: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
  },
  mockOtpCard: {
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 2,
  },
  mockOtpLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  mockOtpValue: {
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 4,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  successText: {
    fontSize: 13,
    lineHeight: 18,
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
  buttonDisabled: {
    opacity: 0.65,
  },
});
