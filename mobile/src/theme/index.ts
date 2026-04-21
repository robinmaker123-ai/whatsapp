import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type PropsWithChildren,
} from "react";
import {
  DarkTheme,
  DefaultTheme,
  type Theme as NavigationTheme,
} from "@react-navigation/native";
import { useColorScheme } from "react-native";

import type { ThemePreference } from "../types/models";

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 32,
  full: 999,
};

export const shadows = {
  soft: {
    shadowColor: "#00140D",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  strong: {
    shadowColor: "#00140D",
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
};

export const lightColors = {
  primary: "#128C7E",
  primaryDark: "#075E54",
  accent: "#25D366",
  accentSoft: "#DDF8E9",
  background: "#E9F3EF",
  backgroundSecondary: "#F5FBF8",
  screen: "#F4F7F5",
  surface: "#FFFFFF",
  surfaceElevated: "#F8FBFA",
  surfaceMuted: "#EEF5F2",
  outgoingBubble: "#DCF8C6",
  incomingBubble: "#FFFFFF",
  header: "#0B5A4F",
  headerAccent: "#1B8A78",
  cardBorder: "#DCE8E2",
  line: "#DDE3E8",
  textPrimary: "#122117",
  textSecondary: "#587066",
  textMuted: "#81948D",
  unreadBadge: "#25D366",
  readReceipt: "#53BDEB",
  danger: "#D64545",
  overlay: "rgba(8, 36, 30, 0.16)",
  tabInactive: "rgba(255,255,255,0.72)",
  fab: "#25D366",
  shadow: "rgba(8, 36, 30, 0.12)",
};

export const darkColors = {
  primary: "#1AA78F",
  primaryDark: "#0D6B5F",
  accent: "#34D97B",
  accentSoft: "#143E2E",
  background: "#0D1714",
  backgroundSecondary: "#12211D",
  screen: "#0F1C18",
  surface: "#162521",
  surfaceElevated: "#1A2C27",
  surfaceMuted: "#1F332D",
  outgoingBubble: "#1D6F5F",
  incomingBubble: "#1B2C27",
  header: "#081C18",
  headerAccent: "#0E4C43",
  cardBorder: "#274139",
  line: "#244039",
  textPrimary: "#F3FCF7",
  textSecondary: "#A8C0B7",
  textMuted: "#7E9990",
  unreadBadge: "#34D97B",
  readReceipt: "#67CFF7",
  danger: "#FF7A7A",
  overlay: "rgba(0, 0, 0, 0.32)",
  tabInactive: "rgba(243,252,247,0.72)",
  fab: "#29C56E",
  shadow: "rgba(0, 0, 0, 0.32)",
};

export type AppColors = typeof lightColors;

export type AppTheme = {
  colors: AppColors;
  isDark: boolean;
  preference: ThemePreference;
};

const ThemeContext = createContext<AppTheme | null>(null);

const resolveScheme = (
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined
) => {
  if (preference === "dark") {
    return "dark";
  }

  if (preference === "light") {
    return "light";
  }

  return systemScheme === "dark" ? "dark" : "light";
};

export const createAppTheme = (
  preference: ThemePreference,
  systemScheme: "light" | "dark" | null | undefined
): AppTheme => {
  const resolvedScheme = resolveScheme(preference, systemScheme);

  return {
    colors: resolvedScheme === "dark" ? darkColors : lightColors,
    isDark: resolvedScheme === "dark",
    preference,
  };
};

export const ThemeProvider = ({
  children,
  preference = "system",
}: PropsWithChildren<{ preference?: ThemePreference }>) => {
  const systemScheme = useColorScheme();
  const theme = useMemo(
    () => createAppTheme(preference, systemScheme),
    [preference, systemScheme]
  );

  return createElement(ThemeContext.Provider, { value: theme }, children);
};

export const useAppTheme = () => {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useAppTheme must be used within ThemeProvider.");
  }

  return context;
};

export const buildNavigationTheme = (palette: AppColors): NavigationTheme => ({
  ...(palette === darkColors ? DarkTheme : DefaultTheme),
  colors: {
    ...(palette === darkColors ? DarkTheme.colors : DefaultTheme.colors),
    background: palette.screen,
    card: palette.surface,
    border: palette.cardBorder,
    primary: palette.primary,
    text: palette.textPrimary,
    notification: palette.accent,
  },
});

export const navigationTheme = buildNavigationTheme(lightColors);
