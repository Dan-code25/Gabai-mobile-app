import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppText } from "../components/ui/AppText";
import { TabScreen } from "../components/ui/TabScreen";
import { useLanguage } from "../i18n/useLanguage";
import { useAppData } from "../storage/useAppData";
import { homeTheme } from "../theme/home";

export default function SettingsScreen() {
  const { t, language, setLanguage } = useLanguage();
  const { error } = useAppData();
  return <TabScreen title={t("Settings")} tab="Settings"><ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
    <AppText weight="extraBold" accessibilityRole="header" style={styles.heading}>{t("Language Preference")}</AppText>
    <View style={styles.card}>
      <AppText weight="bold" style={styles.title}>{t("Choose your language")}</AppText>
      <AppText style={styles.description}>{t("For the app and future AI replies.")}</AppText>
      {(["en", "fil"] as const).map(value => <Pressable key={value} onPress={() => { void setLanguage(value).catch(() => undefined); }} accessibilityRole="radio" accessibilityState={{ checked: language === value }}
        android_ripple={{ color: homeTheme.colors.lavender }} style={[styles.option, language === value && styles.selected]}>
        <AppText weight="bold" style={styles.optionText}>{value === "en" ? "English" : "Filipino"}</AppText>
        <Ionicons name={language === value ? "radio-button-on" : "radio-button-off"} size={25} color={homeTheme.colors.purple} accessible={false} />
      </Pressable>)}
    </View>
    {error && <AppText accessibilityLiveRegion="polite" style={styles.error}>{t(error)}</AppText>}
    <AppText weight="extraBold" accessibilityRole="header" style={styles.heading}>{t("About GabAI")}</AppText>
    <View style={styles.card}>
      <View style={styles.brand}><Image source={require("../../assets/images/gabai-logo.png")} style={styles.logo} accessible={false} />
        <View><AppText weight="extraBold" style={styles.title}>GabAI</AppText><AppText style={styles.description}>{t("Version")} {Constants.expoConfig?.version ?? "1.0.0"}</AppText></View></View>
      <AppText style={styles.description}>{t("Your offline AI assistant for understanding what's on your screen.")}</AppText>
      <View style={styles.privacy}><Ionicons name="shield-checkmark-outline" size={22} color={homeTheme.colors.purple} accessible={false} />
        <AppText style={[styles.description, { flex: 1 }]}>{t("Your conversations and AI processing stay on your device.")}</AppText></View>
    </View>
  </ScrollView></TabScreen>;
}
const styles = StyleSheet.create({
  heading: { fontSize: 21, lineHeight: 30, marginTop: 12, marginBottom: 10 },
  card: { backgroundColor: homeTheme.colors.white, borderRadius: 24, padding: 18, gap: 12, marginBottom: 16, borderWidth: 1, borderColor: homeTheme.colors.lavender },
  title: { fontSize: 20, lineHeight: 28 }, description: { fontSize: 16, lineHeight: 24, color: homeTheme.colors.muted },
  option: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 56, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: homeTheme.colors.lavender },
  selected: { backgroundColor: homeTheme.colors.lavenderPale, borderColor: homeTheme.colors.purple }, optionText: { fontSize: 18, lineHeight: 25 },
  brand: { flexDirection: "row", gap: 12, alignItems: "center" }, logo: { width: 56, height: 56, borderRadius: 18 },
  privacy: { flexDirection: "row", gap: 10, backgroundColor: homeTheme.colors.lavenderPale, padding: 12, borderRadius: 16 },
  error: { color: homeTheme.colors.ink, fontSize: 14, lineHeight: 21, padding: 12, backgroundColor: homeTheme.colors.coralPale, borderRadius: 16 },
});
