import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ReactNode } from "react";
import { BottomNavigation, type HomeTab } from "../home/BottomNavigation";
import { AppText } from "./AppText";
import { openTab } from "../../navigation/tabs";

export function TabScreen({ title, tab, children }: { title: string; tab: HomeTab; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <View className="flex-1 bg-gabai-cream" style={{ paddingTop: insets.top + 12, paddingLeft: insets.left + 20, paddingRight: insets.right + 20, paddingBottom: Math.max(insets.bottom, 12) }}>
    <AppText weight="extraBold" accessibilityRole="header" style={styles.title}>{title}</AppText>
    <View style={{ flex: 1 }}>{children}</View>
    <View style={{ paddingTop: 8 }}><BottomNavigation activeTab={tab} onSelect={openTab} largeText={fontScale > 1.3} /></View>
  </View>;
}
const styles = StyleSheet.create({ title: { fontSize: 28, lineHeight: 38, marginBottom: 16 } });
