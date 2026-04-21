import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "./src/components/AppErrorBoundary";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { ThemeProvider, useAppTheme } from "./src/theme";

const ThemedApp = () => {
  const { themePreference } = useAuth();

  return (
    <ThemeProvider preference={themePreference}>
      <AppShell />
    </ThemeProvider>
  );
};

const AppShell = () => {
  const { colors, isDark } = useAppTheme();

  return (
    <View style={[styles.app, { backgroundColor: colors.screen }]}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppNavigator />
    </View>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <SafeAreaProvider>
        <AuthProvider>
          <ThemedApp />
        </AuthProvider>
      </SafeAreaProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
  },
});
