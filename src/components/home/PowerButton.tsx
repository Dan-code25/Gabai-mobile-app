import { useLanguage } from "../../i18n/useLanguage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet } from "react-native";

import { homeTheme } from "../../theme/home";

type PowerButtonProps = { size: number; onPress: () => void; enabled?: boolean; busy?: boolean };

export function PowerButton({ size, onPress, enabled, busy }: PowerButtonProps) {
  const { t } = useLanguage();
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(enabled ? "Stop GabAI floating assistant" : "Start GabAI floating assistant")}
      accessibilityHint={t("Controls the Shiba assistant above other Android apps.")}
      accessibilityState={{ busy, disabled: busy, selected: enabled }}
      disabled={busy}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.button, enabled && styles.active, { width: size, height: size, borderRadius: size / 2, opacity: busy ? 0.7 : pressed ? 0.8 : 1 }]}
    >
      <LinearGradient
        colors={enabled ? ["#FFAA98", homeTheme.colors.coral, "#F35B49"] : ["#9986FF", "#6B53F5", "#4D31E7"]}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={[styles.surface, { borderRadius: size / 2 }]}
      >
        {busy ? <ActivityIndicator size="large" color={homeTheme.colors.white} /> :
          <Ionicons name={enabled ? "stop" : "power-outline"} size={size * 0.43} color={enabled ? homeTheme.colors.ink : homeTheme.colors.white} accessible={false} />}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  active: { backgroundColor: homeTheme.colors.coral, boxShadow: "0 9px 20px rgba(255,113,91,0.28)" },
  button: {
    backgroundColor: homeTheme.colors.purpleDark, padding: 3, paddingBottom: 6,
    boxShadow: "0 9px 20px rgba(80, 48, 200, 0.28)",
  },
  surface: {
    flex: 1, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.24)",
  },
});
