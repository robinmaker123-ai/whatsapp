import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  override state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>VideoApp could not open.</Text>
            <Text style={styles.body}>
              The app hit an unexpected error. Tap retry to render it again.
            </Text>
            <Pressable
              onPress={() => this.setState({ hasError: false })}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>Retry</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F1C18",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 24,
    backgroundColor: "#162521",
    padding: 24,
  },
  title: {
    color: "#F3FCF7",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 10,
  },
  body: {
    color: "#A8C0B7",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#25D366",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonLabel: {
    color: "#083126",
    fontWeight: "800",
  },
});