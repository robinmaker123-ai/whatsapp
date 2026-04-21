import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { StartupScreen } from "../screens/StartupScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { useAuth } from "../contexts/AuthContext";
import { buildNavigationTheme, useAppTheme } from "../theme";
import type { RootStackParamList } from "../types/navigation";
import { ChatScreen } from "../screens/ChatScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { CallScreen } from "../screens/CallScreen";
import { StatusViewerScreen } from "../screens/StatusViewerScreen";

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator = () => {
  const { colors } = useAppTheme();
  const { appMode, isBootstrapping } = useAuth();

  if (isBootstrapping) {
    return <StartupScreen />;
  }

  return (
    <NavigationContainer key={appMode} theme={buildNavigationTheme(colors)}>
      <Stack.Navigator
        initialRouteName={appMode === "login" ? "Login" : "Home"}
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: {
            fontWeight: "700",
          },
          contentStyle: {
            backgroundColor: colors.screen,
          },
        }}
      >
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="Call"
          component={CallScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "slide_from_bottom",
          }}
        />
        <Stack.Screen
          name="StatusViewer"
          component={StatusViewerScreen}
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "fade",
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
