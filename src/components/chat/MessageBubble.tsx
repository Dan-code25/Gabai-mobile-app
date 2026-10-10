import { useLanguage } from "../../i18n/useLanguage";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import type { DisplayMessage } from "../../chat/conversation";
import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";

export function MessageBubble({ message, generating }: { message: DisplayMessage; generating: boolean }) {
  const { t } = useLanguage();
  const user = message.role === "user";
  return (
    <View style={[styles.row, user && styles.userRow]}>
      {!user && <Image source={require("../../../assets/images/gabai-logo.png")} accessibilityLabel={t("GabAI")} style={styles.avatar} />}
      <View style={[styles.bubble, user ? styles.userBubble : styles.assistantBubble, message.failed && styles.errorBubble]}>
        <AppText weight="bold" style={[styles.sender, user && styles.white]}>{user ? t("You") : "GabAI"}</AppText>
        {message.screenshot && !message.imageUri && <AppText style={[styles.sender, user && styles.white]}>{t("Screenshot text saved")}</AppText>}
        {message.imageUri && <Image source={{ uri: message.imageUri }} accessibilityLabel={t("Selected screenshot crop")} resizeMode="contain" style={styles.thumbnail} />}
        {message.text ? <AppText selectable style={[styles.text, user && styles.white]}>{message.failed ? t(message.text) : message.text}</AppText>
          : generating ? <View style={styles.loading} accessibilityLabel={t("GabAI is generating a response")}>
            <ActivityIndicator size="small" color={homeTheme.colors.purple} /><AppText style={styles.loadingText}>{t("Thinking…")}</AppText>
          </View> : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "flex-end", paddingVertical: 8 },
  userRow: { justifyContent: "flex-end" }, avatar: { width: 30, height: 30, borderRadius: 10, marginBottom: 4 },
  bubble: { maxWidth: "86%", flexShrink: 1, borderRadius: 22, padding: 14, gap: 6 },
  userBubble: { backgroundColor: homeTheme.colors.purple, borderBottomRightRadius: 6 },
  assistantBubble: { backgroundColor: homeTheme.colors.lavenderPale, borderBottomLeftRadius: 6, borderWidth: 1, borderColor: homeTheme.colors.lavender },
  errorBubble: { backgroundColor: homeTheme.colors.coralPale },
  sender: { fontSize: 13, lineHeight: 18, color: homeTheme.colors.muted },
  text: { fontSize: 17, lineHeight: 25 }, white: { color: homeTheme.colors.white },
  thumbnail: { width: 220, maxWidth: "100%", height: 150, borderRadius: 12, backgroundColor: homeTheme.colors.white },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  loadingText: { color: homeTheme.colors.muted, fontSize: 15 },
});
