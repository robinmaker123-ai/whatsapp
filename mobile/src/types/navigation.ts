import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import type { CallRecord, StatusFeedEntry, User } from "./models";

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  Chat: {
    participant: User;
  };
  Settings: undefined;
  Call: {
    call: CallRecord;
    participant: User;
    isIncoming?: boolean;
  };
  StatusViewer: {
    entry: StatusFeedEntry;
    initialIndex?: number;
  };
};

export type LoginScreenProps = NativeStackScreenProps<RootStackParamList, "Login">;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, "Home">;
export type ChatScreenProps = NativeStackScreenProps<RootStackParamList, "Chat">;
export type SettingsScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "Settings"
>;
export type CallScreenProps = NativeStackScreenProps<RootStackParamList, "Call">;
export type StatusViewerScreenProps = NativeStackScreenProps<
  RootStackParamList,
  "StatusViewer"
>;
