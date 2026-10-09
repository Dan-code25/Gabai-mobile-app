import { useLanguage } from "../../i18n/useLanguage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";

export type HomeTab = "Home" | "Chat" | "History" | "Settings";

const items = [
  { label: "Home", icon: "home" },
  { label: "Chat", icon: "chatbubble-ellipses-outline" },
  { label: "History", icon: "time-outline" },
  { label: "Settings", icon: "settings-outline" },
] as const;

type BottomNavigationProps = { onSelect: (tab: HomeTab) => void; largeText?: boolean; activeTab?: HomeTab };

export function BottomNavigation({ onSelect, largeText, activeTab = "Home" }: BottomNavigationProps) {
  const { t } = useLanguage();
  const [pressedTab, setPressedTab] = useState<HomeTab | null>(null);

  return (
    <View style={[styles.bar, largeText && styles.wrappedBar]}>
      {items.map(({ label, icon }) => {
        const selected = label === activeTab;
        return (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={t(label)}
            accessibilityState={{ selected }}
            accessibilityHint={t(label)}
            onPress={() => onSelect(label)}
            onPressIn={() => setPressedTab(label)}
            onPressOut={() => setPressedTab(null)}
            style={[styles.item, largeText && styles.wrappedItem, selected && styles.selected, { opacity: pressedTab === label ? 0.65 : 1 }]}
          >
            <Ionicons name={icon} size={28} color={selected ? homeTheme.colors.purple : homeTheme.colors.muted} accessible={false} />
            <AppText weight="bold" style={[styles.label, { color: selected ? homeTheme.colors.purple : homeTheme.colors.muted }]}>{t(label)}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "stretch", gap: 4, borderRadius: 32,
    padding: 6, backgroundColor: "#FFFCF9", borderWidth: 1, borderColor: homeTheme.colors.white,
    boxShadow: "0 5px 20px rgba(129,91,87,0.08)",
  },
  item: { flex: 1, minWidth: 0, minHeight: 76, paddingHorizontal: 2, paddingVertical: 10, gap: 5, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  wrappedBar: { flexWrap: "wrap" },
  wrappedItem: { flexGrow: 1, flexShrink: 1, flexBasis: "45%", flexDirection: "row", gap: 8 },
  selected: { backgroundColor: homeTheme.colors.lavender },
  label: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
