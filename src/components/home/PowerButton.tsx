import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { homeTheme } from "../../theme/home";

type PowerButtonProps = { size: number; onPress: () => void; enabled?: boolean; busy?: boolean };

export function PowerButton({ size, onPress, enabled, busy }: PowerButtonProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={enabled ? "Stop GabAI floating assistant" : "Start GabAI floating assistant"}
      accessibilityHint="Controls the Shiba assistant above other Android apps."
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.button, { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.8 : 1 }]}
    >
      <LinearGradient
        colors={["#9986FF", "#6B53F5", "#4D31E7"]}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.surface, { borderRadius: size / 2 }]}
      >
        {busy ? <ActivityIndicator size="large" color={homeTheme.colors.white} /> :
          <Ionicons name="power-outline" size={size * 0.43} color={homeTheme.colors.white} accessible={false} />}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: homeTheme.colors.purpleDark, padding: 3, paddingBottom: 6,
    boxShadow: "0 9px 20px rgba(80, 48, 200, 0.28)",
  },
  surface: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.24)",
  },
});
