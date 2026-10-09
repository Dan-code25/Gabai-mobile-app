import { Image, Pressable, StyleSheet, View } from "react-native";

import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";

type HomeHeaderProps = {
  greeting: string;
  onLanguagePress: () => void;
  stacked?: boolean;
};

export function HomeHeader({ greeting, onLanguagePress, stacked }: HomeHeaderProps) {
  return (
    <View style={[styles.header, stacked && styles.stacked]}>
      <View className="flex-1 flex-row items-center gap-3">
        <Image
          source={require("../../../assets/images/gabai-logo.png")}
          style={styles.logo}
          accessible={false}
          resizeMode="cover"
        />
        <View className="flex-1 gap-0.5">
          <AppText weight="extraBold" accessibilityRole="header" style={styles.greeting}>
            {greeting}
          </AppText>
          <AppText weight="semibold" style={styles.brand}>GabAI</AppText>
        </View>
      </View>
      <View style={styles.language}>
        <View style={styles.languageOption} accessible accessibilityLabel="English, selected">
          <AppText weight="extraBold" style={styles.languageText}>EN</AppText>
        </View>
        <View style={styles.divider} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filipino language"
          accessibilityHint="Find out about the upcoming Filipino language option."
          onPress={onLanguagePress}
          style={({ pressed }) => [styles.languageOption, { opacity: pressed ? 0.55 : 1 }]}
        >
          <AppText weight="bold" style={[styles.languageText, styles.muted]}>FIL</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  stacked: { flexDirection: "column", alignItems: "stretch" },
  logo: { width: 54, height: 54, borderRadius: 16 },
  greeting: { fontSize: 20, lineHeight: 27 },
  brand: { fontSize: 16, lineHeight: 22, color: homeTheme.colors.muted },
  language: {
    flexDirection: "row", alignItems: "center", alignSelf: "flex-end",
    borderRadius: 28, backgroundColor: homeTheme.colors.white,
    paddingHorizontal: 4, borderWidth: 1, borderColor: "#FFFFFF",
    boxShadow: "0 5px 16px rgba(74, 55, 129, 0.08)",
  },
  languageOption: { minWidth: 46, minHeight: 48, paddingHorizontal: 8, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  languageText: { fontSize: 16, lineHeight: 22 },
  divider: { width: 1, height: 16, backgroundColor: "#D7D1E8" },
  muted: { color: homeTheme.colors.muted },
});
