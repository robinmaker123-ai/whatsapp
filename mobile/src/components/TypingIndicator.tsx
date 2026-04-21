import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { radii, shadows, spacing, useAppTheme } from "../theme";

const TypingDot = ({ delay }: { delay: number }) => {
  const opacity = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.25,
          duration: 320,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [delay, opacity]);

  const { colors } = useAppTheme();

  return <Animated.View style={[styles.dot, { opacity, backgroundColor: colors.accent }]} />;
};

export const TypingIndicator = ({ name }: { name: string }) => {
  const { colors } = useAppTheme();

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: colors.incomingBubble,
          },
        ]}
      >
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {name} is typing
        </Text>
        <View style={styles.dots}>
          <TypingDot delay={0} />
          <TypingDot delay={140} />
          <TypingDot delay={280} />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    alignItems: "flex-start",
  },
  bubble: {
    borderRadius: radii.md,
    borderBottomLeftRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.soft,
  },
  label: {
    fontSize: 12,
    marginBottom: spacing.xs,
  },
  dots: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
