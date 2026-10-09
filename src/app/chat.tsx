import { useLanguage } from "../i18n/useLanguage";
import { openTab } from "../navigation/tabs";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Keyboard, KeyboardAvoidingView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatConversation } from "../chat/ChatProvider";
import { pickCroppedScreenshot } from "../chat/screenshot";
import type { DisplayMessage } from "../chat/conversation";
import { ChatHeader } from "../components/chat/ChatHeader";
import { ChatComposer } from "../components/chat/ChatComposer";
import { MessageBubble } from "../components/chat/MessageBubble";
import { BottomNavigation, type HomeTab } from "../components/home/BottomNavigation";
import { AppText } from "../components/ui/AppText";
import { FeatureNotice, type NoticeContent } from "../components/ui/FeatureNotice";
import { getSavedModel, importModel, isLocalAiAvailable } from "../local-ai/runtime";
import { homeTheme } from "../theme/home";

export default function ChatScreen() {
  const { t } = useLanguage();
  const { conversation, state } = useChatConversation();
  const { screenshot } = useLocalSearchParams<{ screenshot?: string }>();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [draft, setDraft] = useState("");
  const [picking, setPicking] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  const pending = useRef(false);
  const handled = useRef<string | null>(null);
  const list = useRef<FlatList<DisplayMessage>>(null);
  const gutter = width < 360 ? 12 : 16;
  const busy = state.busy || picking;

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  async function ensureModel() {
    if (!isLocalAiAvailable()) throw new Error("Open the installed Android development app to use offline AI.");
    return Boolean(getSavedModel() || await importModel());
  }

  const selectScreenshot = useCallback(async () => {
    if (pending.current || conversation.getSnapshot().busy) {
      setNotice({ title: "GabAI is answering", message: "Wait for the current answer, then choose your screenshot." });
      return;
    }
    pending.current = true; setPicking(true); Keyboard.dismiss();
    try {
      const uri = await pickCroppedScreenshot();
      if (!uri) return;
      if (!await ensureModel()) return;
      await conversation.explainImage(uri);
    } catch (error) {
      setNotice({ title: "Screenshot help", message: error instanceof Error ? error.message : String(error) });
    } finally { pending.current = false; setPicking(false); }
  }, [conversation]);

  useEffect(() => {
    if (!screenshot || handled.current === screenshot) return;
    handled.current = screenshot;
    router.setParams({ screenshot: undefined });
    void selectScreenshot();
  }, [screenshot, selectScreenshot]);

  async function send() {
    const text = draft.trim();
    if (!text || pending.current || state.busy) return;
    pending.current = true; setPicking(true);
    try {
      if (!await ensureModel()) return;
      setDraft("");
      await conversation.send(text);
    } catch (error) {
      setNotice({ title: "Offline AI", message: error instanceof Error ? error.message : String(error) });
    } finally { pending.current = false; setPicking(false); }
  }

  function selectTab(tab: HomeTab) {
    if (tab === "Home") { Keyboard.dismiss(); router.replace("/"); }
    else if (tab === "Chat") list.current?.scrollToEnd({ animated: false });
    else { Keyboard.dismiss(); openTab(tab); }
  }

  return (
    <View className="flex-1 bg-gabai-cream">
      <KeyboardAvoidingView behavior="height" style={{ flex: 1, paddingTop: insets.top, paddingLeft: insets.left + gutter, paddingRight: insets.right + gutter,
        paddingBottom: keyboardOpen ? 4 : Math.max(insets.bottom, 12) }}>
        <ChatHeader disabled={busy} onNew={() => { conversation.reset(); setDraft(""); }} />
        <FlatList ref={list} data={state.messages} keyExtractor={message => message.id} style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 12, flexGrow: 1 }} showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => <MessageBubble message={item} generating={state.busy && item.id === state.messages.at(-1)?.id} />}
          ListEmptyComponent={<View style={styles.empty}>
            <Image source={require("../../assets/images/shiba-wave.png")} accessibilityLabel={t("GabAI waving Shiba")} resizeMode="contain" style={styles.mascot} />
            <AppText weight="extraBold" style={styles.emptyTitle}>{t("How can I help?")}</AppText>
            <AppText style={styles.emptyText}>{t("Ask a question, or choose a screenshot and I’ll explain it simply.")}</AppText>
            <View style={styles.offlineNote}><AppText style={styles.noteText}>{t("Your questions stay on your phone.")}</AppText></View>
          </View>} />
        {(state.status || picking && !state.busy) ? <View style={styles.status} accessibilityLiveRegion="polite">
          {busy && <ActivityIndicator size="small" color={homeTheme.colors.purple} />}
          <AppText style={styles.statusText}>{t(state.status || "Opening your selection…")}</AppText>
        </View> : null}
        {state.error && <AppText accessibilityLiveRegion="polite" style={styles.statusText}>{t(state.error)}</AppText>}
        <ChatComposer value={draft} onChange={setDraft} busy={busy} onSend={() => { void send(); }} onScreenshot={() => { void selectScreenshot(); }} />
        {!keyboardOpen && <View style={styles.navigation}><BottomNavigation activeTab="Chat" onSelect={selectTab} largeText={fontScale > 1.3} /></View>}
      </KeyboardAvoidingView>
      <FeatureNotice content={notice} onClose={() => setNotice(null)} />
    </View>
  );
}
const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 20 },
  mascot: { width: 180, height: 130, marginBottom: 20 },
  emptyTitle: { fontSize: 25, lineHeight: 34, textAlign: "center", marginBottom: 8 },
  emptyText: { fontSize: 16, lineHeight: 25, textAlign: "center", color: homeTheme.colors.muted },
  offlineNote: { marginTop: 20, backgroundColor: homeTheme.colors.peach, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  noteText: { fontSize: 13, lineHeight: 19, color: homeTheme.colors.ink },
  status: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  statusText: { flex: 1, fontSize: 13, lineHeight: 19, color: homeTheme.colors.muted },
  navigation: { paddingTop: 8 },
});
