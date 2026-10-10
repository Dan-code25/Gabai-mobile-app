import { useLanguage } from "../../i18n/useLanguage";
import { Image, Pressable, StyleSheet, View } from "react-native";

import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";

type HomeHeaderProps = {
  greeting: string;
  stacked?: boolean;
};

export function HomeHeader({ greeting, stacked }: HomeHeaderProps) {
  const { language, setLanguage, t } = useLanguage();
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
          <AppText weight="extraBold" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={styles.greeting}>
            {greeting}
          </AppText>
          <AppText weight="semibold" style={styles.brand}>GabAI</AppText>
        </View>
      </View>
      <View style={styles.language}>
        {(["en", "fil"] as const).map(value => <Pressable key={value} accessibilityRole="radio" accessibilityLabel={t(value === "en" ? "English" : "Filipino")} accessibilityState={{ checked: language === value }}
            onPress={() => { void setLanguage(value).catch(() => undefined); }} android_ripple={{ color: "#D7D1E8" }} style={[styles.languageOption, language === value && styles.selected]}>
            <AppText weight="extraBold" style={[styles.languageText, language !== value && styles.muted]}>{value === "en" ? "EN" : "FIL"}</AppText>
          </Pressable>)}
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
    padding: 4, gap: 8, borderWidth: 1, borderColor: "#FFFFFF",
    boxShadow: "0 5px 16px rgba(74, 55, 129, 0.08)",
  },
  languageOption: { minWidth: 52, minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: "transparent", paddingHorizontal: 10, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: homeTheme.colors.lavender, borderColor: homeTheme.colors.purple },
  languageText: { fontSize: 16, lineHeight: 22, color: homeTheme.colors.purpleDark },
  muted: { color: homeTheme.colors.muted },
});
