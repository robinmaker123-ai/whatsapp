import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";
import { getInitials } from "../utils/format";

type AvatarProps = {
  name: string;
  profilePic?: string;
  size?: number;
};

export const Avatar = ({ name, profilePic, size = 52 }: AvatarProps) => {
  const { colors } = useAppTheme();
  const [hasImageError, setHasImageError] = useState(false);

  useEffect(() => {
    setHasImageError(false);
  }, [profilePic, size]);

  if (profilePic && !hasImageError) {
    return (
      <Image
        source={{ uri: profilePic }}
        style={[
          styles.image,
          {
            backgroundColor: colors.line,
            width: size,
            height: size,
            borderRadius: size / 2,
          },
        ]}
        onError={() => setHasImageError(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          backgroundColor: colors.primaryDark,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text
        style={[
          styles.initials,
          {
            color: colors.surface,
          },
        ]}
      >
        {getInitials(name)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {},
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontSize: 18,
    fontWeight: "700",
  },
});
