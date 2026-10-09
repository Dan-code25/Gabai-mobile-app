import { router } from "expo-router";
import { useRef, useState } from "react";
import { ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActionCard } from "../components/home/ActionCard";
import { AssistantCard } from "../components/home/AssistantCard";
import { BottomNavigation, type HomeTab } from "../components/home/BottomNavigation";
import { HomeHeader } from "../components/home/HomeHeader";
import { AppText } from "../components/ui/AppText";
import { FeatureNotice, type NoticeContent } from "../components/ui/FeatureNotice";
import { homeTheme } from "../theme/home";
import { useFloatingAssistant } from "../floating-assistant/useFloatingAssistant";

const notices = {
  assistant: {
    title: "Your assistant is coming soon",
    message: "GabAI will help you while you use other apps. The assistant is not available yet.",
  },
  screenshot: {
    title: "Screenshot help is coming soon",
    message: "You'll be able to choose a screenshot and ask GabAI to explain it. This feature is not available yet.",
  },
  chat: {
    title: "Ask GabAI is coming soon",
    message: "You'll be able to ask questions and get helpful explanations. Chat is not available yet.",
  },
  language: {
    title: "Filipino is coming soon",
    message: "GabAI is currently in English. The Filipino language option will be available in a future update.",
  },
  history: {
    title: "History is coming soon",
    message: "Your past explanations will appear here when screenshot help and chat are available.",
  },
  settings: {
    title: "Settings are coming soon",
    message: "You'll be able to personalize GabAI here in a future update.",
  },
} satisfies Record<string, NoticeContent>;

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning!";
  if (hour < 18) return "Good afternoon!";
  return "Good evening!";
}

export default function HomeScreen() {
  const assistant = useFloatingAssistant();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const [notice, setNotice] = useState<NoticeContent | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const gutter = width < 360 ? 16 : 20;
  const contentWidth = Math.min(width - gutter * 2 - insets.left - insets.right, 460);
  const largeText = fontScale > 1.3;

  function selectTab(tab: HomeTab) {
    if (tab === "Home") {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      router.replace("/");
      return;
    }
    setNotice(notices[tab === "Chat" ? "chat" : tab === "History" ? "history" : "settings"]);
  }

  return (
    <View className="flex-1 bg-gabai-cream">
      <View style={styles.backgroundOrb} pointerEvents="none" accessible={false} />
      <View style={styles.bottomOrb} pointerEvents="none" accessible={false} />
      <View style={{ flex: 1 }} importantForAccessibility={notice ? "no-hide-descendants" : "auto"}>
        <ScrollView
          ref={scrollRef} showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: insets.top + 16,
            paddingLeft: insets.left + gutter,
            paddingRight: insets.right + gutter,
            paddingBottom: 20,
          }}
        >
          <View style={[styles.content, { width: contentWidth }]}>
            <HomeHeader greeting={getGreeting()} onLanguagePress={() => setNotice(notices.language)} stacked={width < 360 || fontScale > 1.15} />
            <AssistantCard contentWidth={contentWidth} enabled={assistant.enabled} busy={assistant.busy}
              onStartPress={() => { void assistant.toggle().catch(error => setNotice({ title: "Floating assistant", message: error instanceof Error ? error.message : String(error) })); }} />
            <AppText weight="extraBold" accessibilityRole="header" style={styles.sectionTitle}>Main Actions</AppText>
            <View className="gap-3">
              <ActionCard
                title="Explain a Screenshot" description="Choose an image to understand what's on it."
                icon="camera" tone="purple" stacked={largeText || contentWidth < 310}
                onPress={() => setNotice(notices.screenshot)}
              />
              <ActionCard
                title="Ask GabAI" description="Ask a question or get more information."
                icon="chatbubble-ellipses" tone="coral" stacked={largeText || contentWidth < 310}
                onPress={() => setNotice(notices.chat)}
              />
            </View>
          </View>
        </ScrollView>
        <View style={{ paddingLeft: gutter + insets.left, paddingRight: gutter + insets.right, paddingBottom: Math.max(insets.bottom, 12), paddingTop: 8 }}>
          <View style={[styles.content, { width: contentWidth }]}>
            <BottomNavigation onSelect={selectTab} largeText={largeText} />
          </View>
        </View>
      </View>
      <FeatureNotice content={notice} onClose={() => setNotice(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignSelf: "center" },
  sectionTitle: { fontSize: 25, lineHeight: 34, marginTop: 20, marginBottom: 10, paddingHorizontal: 4 },
  backgroundOrb: { position: "absolute", width: 200, height: 200, borderRadius: 100, right: -152, top: "42%", backgroundColor: homeTheme.colors.peach },
  bottomOrb: { position: "absolute", width: 180, height: 180, borderRadius: 90, left: -148, bottom: 86, backgroundColor: homeTheme.colors.peach },
});
