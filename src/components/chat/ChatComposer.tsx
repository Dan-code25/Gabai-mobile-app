import { useLanguage } from "../../i18n/useLanguage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";

type Props = { value: string; onChange: (text: string) => void; onSend: () => void; onScreenshot: () => void; busy: boolean };
export function ChatComposer({ value, onChange, onSend, onScreenshot, busy }: Props) {
  const { t } = useLanguage();
  const canSend = !busy && Boolean(value.trim());
  return (
    <View style={styles.composer}>
      <AppText weight="bold" style={styles.label}>{t("Your message")}</AppText>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Choose and crop a screenshot")} accessibilityState={{ disabled: busy }}
          disabled={busy} onPress={onScreenshot} android_ripple={{ color: homeTheme.colors.peach }} style={[styles.camera, busy && styles.disabled]}>
          <Ionicons name="image-outline" size={25} color={homeTheme.colors.purple} accessible={false} />
        </Pressable>
        <TextInput accessibilityLabel={t("Your message")} placeholder={t("Ask GabAI anything...")} value={value} onChangeText={onChange}
          placeholderTextColor={homeTheme.colors.muted} multiline maxLength={400} textAlignVertical="top"
          editable={!busy} autoCapitalize="sentences" style={styles.input} />
        <Pressable accessibilityRole="button" accessibilityLabel={t("Send message")} accessibilityState={{ disabled: !canSend }}
          disabled={!canSend} onPress={onSend} android_ripple={{ color: homeTheme.colors.purpleDark }} style={[styles.send, !canSend && styles.disabled]}>
          <Ionicons name="arrow-up" size={24} color={homeTheme.colors.white} accessible={false} />
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  composer: { paddingTop: 8, paddingBottom: 6 }, label: { fontSize: 13, lineHeight: 20, color: homeTheme.colors.muted, marginBottom: 5, marginLeft: 2 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  camera: { width: 48, height: 52, borderRadius: 18, backgroundColor: homeTheme.colors.lavender, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 52, maxHeight: 120, fontFamily: homeTheme.fonts.regular, fontSize: 16, lineHeight: 23, color: homeTheme.colors.ink,
    paddingHorizontal: 12, paddingVertical: 13, backgroundColor: homeTheme.colors.white, borderRadius: 18, borderWidth: 1, borderColor: homeTheme.colors.lavender },
  send: { width: 48, height: 52, borderRadius: 18, backgroundColor: homeTheme.colors.purple, alignItems: "center", justifyContent: "center" },
  disabled: { opacity: 0.45 },
});
