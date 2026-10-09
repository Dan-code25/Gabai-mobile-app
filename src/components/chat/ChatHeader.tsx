import { useLanguage } from "../../i18n/useLanguage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";

export function ChatHeader({ onNew, disabled }: { onNew: () => void; disabled: boolean }) {
  const { t } = useLanguage();
  return (
    <View style={styles.header}>
      <Image source={require("../../../assets/images/gabai-logo.png")} accessibilityLabel={t("GabAI logo")} style={styles.logo} />
      <View style={styles.title}>
        <AppText weight="extraBold" accessibilityRole="header" style={styles.name}>GabAI</AppText>
        <View style={styles.offline}>
          <Ionicons name="shield-checkmark-outline" size={14} color={homeTheme.colors.purple} accessible={false} />
          <AppText weight="bold" style={styles.offlineText}>{t("Offline AI")}</AppText>
        </View>
      </View>
      <Pressable onPress={onNew} disabled={disabled} accessibilityState={{ disabled }} accessibilityRole="button" accessibilityLabel={t("Start a new conversation")}
        android_ripple={{ color: homeTheme.colors.lavender }} style={[styles.newButton, disabled && { opacity: 0.45 }]}>
        <Ionicons name="add-outline" size={24} color={homeTheme.colors.purple} accessible={false} />
        <AppText weight="bold" style={styles.newText}>{t("New")}</AppText>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  logo: { width: 48, height: 48, borderRadius: 16 },
  title: { flex: 1 }, name: { fontSize: 24, lineHeight: 30 },
  offline: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  offlineText: { fontSize: 13, lineHeight: 18, color: homeTheme.colors.purple },
  newButton: { minHeight: 48, minWidth: 64, borderRadius: 16, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 2, backgroundColor: homeTheme.colors.lavender },
  newText: { fontSize: 15, color: homeTheme.colors.purple },
});
