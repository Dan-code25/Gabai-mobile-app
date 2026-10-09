import { useLanguage } from "../i18n/useLanguage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, FlatList, Image, Keyboard, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useChatConversation } from "../chat/ChatProvider";
import { AppText } from "../components/ui/AppText";
import { TabScreen } from "../components/ui/TabScreen";
import { appData } from "../storage/appData";
import { useAppData } from "../storage/useAppData";
import type { SavedConversation } from "../storage/types";
import { homeTheme } from "../theme/home";

export default function HistoryScreen() {
  const { t, language } = useLanguage();
  const data = useAppData();
  const { conversation } = useChatConversation();
  const [query, setQuery] = useState("");
  const records = appData.search(query);
  function reopen(record: SavedConversation) {
    if (!conversation.restore(record)) { Alert.alert(t("GabAI is answering"), t("Wait for the current answer before opening another conversation.")); return; }
    Keyboard.dismiss(); router.replace("/chat");
  }
  function remove(record: SavedConversation) {
    Alert.alert(t("Delete conversation?"), t("This removes its saved messages and screenshot text from this phone."), [
      { text: t("Cancel"), style: "cancel" },
      { text: t("Delete"), style: "destructive", onPress: () => { void appData.deleteConversation(record.id).catch(() => Alert.alert(t("History"), t("Could not delete this conversation. Try again."))); } },
    ]);
  }
  return <TabScreen title={t("History")} tab="History">
    <View style={styles.search}><Ionicons name="search-outline" size={22} color={homeTheme.colors.muted} accessible={false} />
      <TextInput value={query} onChangeText={setQuery} placeholder={t("Search conversations")} accessibilityLabel={t("Search conversations")} placeholderTextColor={homeTheme.colors.muted} style={styles.searchInput} />
    </View>
    {data.error && <AppText accessibilityLiveRegion="polite" style={styles.error}>{t(data.error)}</AppText>}
    <FlatList data={records} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingBottom: 12 }}
      ListEmptyComponent={<View style={styles.empty}>
        <Image source={require("../../assets/images/shiba-wave.png")} resizeMode="contain" style={{ width: 180, height: 130 }} accessible={false} />
        <AppText weight="extraBold" style={styles.emptyTitle}>{t(query ? "No matches found." : "No conversations yet.")}</AppText>
        <AppText style={styles.muted}>{t(query ? "Try another word." : "Your previous chats will appear here.")}</AppText>
      </View>}
      renderItem={({ item }) => <View style={styles.card}>
        <Pressable onPress={() => reopen(item)} accessibilityRole="button" accessibilityLabel={item.title} android_ripple={{ color: homeTheme.colors.lavender }} style={styles.open}>
          <View style={styles.kind}><Ionicons name={item.type === "screenshot" ? "image-outline" : "chatbubble-outline"} size={16} color={homeTheme.colors.purple} accessible={false} />
            <AppText weight="bold" style={styles.kindText}>{t(item.type === "screenshot" ? "Screenshot Explanation" : "Regular Chat")}</AppText></View>
          <AppText weight="extraBold" numberOfLines={2} style={styles.cardTitle}>{item.title}</AppText>
          <AppText numberOfLines={2} style={styles.preview}>{item.messages.at(-1)?.text}</AppText>
          <AppText style={styles.date}>{new Date(item.updatedAt).toLocaleString(language === "fil" ? "fil-PH" : "en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t("Delete conversation")} onPress={() => remove(item)} android_ripple={{ color: homeTheme.colors.coralPale }} style={styles.delete}>
          <Ionicons name="trash-outline" size={22} color={homeTheme.colors.muted} accessible={false} />
        </Pressable>
      </View>} />
  </TabScreen>;
}
const styles = StyleSheet.create({
  search: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: homeTheme.colors.white, borderRadius: 18, paddingHorizontal: 14, minHeight: 52, marginBottom: 12, borderWidth: 1, borderColor: homeTheme.colors.lavender },
  searchInput: { flex: 1, fontSize: 16, minHeight: 52, color: homeTheme.colors.ink, fontFamily: homeTheme.fonts.regular },
  card: { flexDirection: "row", backgroundColor: homeTheme.colors.white, borderRadius: 24, marginBottom: 12, overflow: "hidden", borderWidth: 1, borderColor: homeTheme.colors.lavender },
  open: { flex: 1, padding: 16, gap: 7 }, kind: { flexDirection: "row", alignItems: "center", gap: 6 }, kindText: { color: homeTheme.colors.purple, fontSize: 12, lineHeight: 18 },
  cardTitle: { fontSize: 18, lineHeight: 25 }, preview: { fontSize: 15, lineHeight: 22, color: homeTheme.colors.muted }, date: { fontSize: 12, lineHeight: 18, color: homeTheme.colors.muted },
  delete: { width: 48, minHeight: 48, justifyContent: "center", alignItems: "center", alignSelf: "stretch" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 24 }, emptyTitle: { fontSize: 23, lineHeight: 32, marginTop: 16, marginBottom: 8, textAlign: "center" },
  muted: { fontSize: 16, lineHeight: 24, color: homeTheme.colors.muted, textAlign: "center" }, error: { color: homeTheme.colors.ink, fontSize: 14, lineHeight: 21, padding: 12, backgroundColor: homeTheme.colors.coralPale, borderRadius: 16, marginBottom: 12 },
});
