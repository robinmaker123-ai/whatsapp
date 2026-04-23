import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { API_BASE_URL, IS_DEV_BUILD, STARTUP_NETWORK_SUBTITLE } from "../config/env";
import { useAuth } from "../contexts/AuthContext";
import { radii, spacing, useAppTheme } from "../theme";

export const StartupScreen = () => {
  const { colors, isDark } = useAppTheme();
  const { lastConnectionCheckAt, refreshConnection } = useAuth();
  const insets = useSafeAreaInsets();
  const backendTargetLabel = API_BASE_URL || (IS_DEV_BUILD ? "set mobile/.env" : "public release URL missing");

  return (
    <View style={[styles.container, { backgroundColor: colors.screen }]}>
      <View
        style={[
          styles.orbLarge,
          {
            backgroundColor: colors.accentSoft,
          },
        ]}
      />
      <View
        style={[
          styles.orbSmall,
          {
            backgroundColor: colors.primary,
          },
        ]}
      />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl }]}>
        <View
          style={[
            styles.logo,
            {
              backgroundColor: isDark ? colors.surface : colors.primaryDark,
            },
          ]}
        >
          <Text style={[styles.logoText, { color: colors.surface }]}>WA</Text>
        </View>

        <Text style={[styles.title, { color: colors.textPrimary }]}>VideoApp</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {STARTUP_NETWORK_SUBTITLE}
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.cardBorder,
            },
          ]}
        >
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.cardText, { color: colors.textSecondary }]}>
            Syncing account, chats, calls, and status feed.
          </Text>
          <Text style={[styles.cardHint, { color: colors.textMuted }]}>
            Backend target: {backendTargetLabel}
          </Text>
          <Text style={[styles.cardHint, { color: colors.textMuted }]}>
            Last server check:{" "}
            {lastConnectionCheckAt
              ? new Date(lastConnectionCheckAt).toLocaleTimeString()
              : "pending"}
          </Text>
          <Pressable
            onPress={() => void refreshConnection()}
            style={[
              styles.retryButton,
              {
                backgroundColor: colors.primary,
              },
            ]}
          >
            <Text style={[styles.retryLabel, { color: colors.surface }]}>
              Retry connection
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  orbLarge: {
    position: "absolute",
    top: -120,
    right: -70,
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.45,
  },
  orbSmall: {
    position: "absolute",
    bottom: 100,
    left: -100,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.24,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  logo: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "900",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    letterSpacing: -0.6,
    marginBottom: spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 320,
    marginBottom: spacing.xl,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    alignItems: "center",
  },
  cardText: {
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  cardHint: {
    fontSize: 12,
  },
  retryButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
  },
  retryLabel: {
    fontWeight: "800",
  },
});
