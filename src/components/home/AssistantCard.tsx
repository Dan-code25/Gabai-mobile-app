import { useLanguage } from "../../i18n/useLanguage";
import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, View } from "react-native";

import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";
import { PowerButton } from "./PowerButton";

type AssistantCardProps = { contentWidth: number; onStartPress: () => void; enabled?: boolean; busy?: boolean };

export function AssistantCard({ contentWidth, onStartPress, enabled, busy }: AssistantCardProps) {
  const { t } = useLanguage();
  const mascotWidth = Math.min(contentWidth * 0.66, 250);
  const mascotHeight = mascotWidth * (2 / 3);
  const powerSize = Math.min(Math.max(contentWidth * 0.46, 144), 164);
  const powerTop = mascotHeight - 40;

  return (
    <View style={styles.shadow}>
      <LinearGradient
        colors={["#F8F5FF", "#EEEAFF", "#F7F4FF"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View pointerEvents="none" accessible={false} style={[styles.orb, styles.topOrb]} />
        <View pointerEvents="none" accessible={false} style={[styles.orb, styles.leftOrb]} />
        <View pointerEvents="none" accessible={false} style={[styles.orb, styles.bottomOrb]} />
        <AppText weight="extraBold" style={styles.eyebrow}>{t("ASSISTANT")}</AppText>
        <View style={[styles.stage, { height: powerTop + powerSize + 10 }]}>
          <View
            pointerEvents="none" accessible={false}
            style={[styles.halo, { width: mascotWidth + 28, height: mascotHeight + 14, borderRadius: mascotWidth / 2 }]}
          />
          <Image
            source={require("../../../assets/images/shiba-wave.png")}
            resizeMode="contain" accessible={false}
            style={{ width: mascotWidth, height: mascotHeight }}
          />
          <View style={[styles.powerPosition, { top: powerTop }]}>
            <PowerButton size={powerSize} onPress={onStartPress} enabled={enabled} busy={busy} />
          </View>
        </View>
        <View style={styles.titleRow}>
          <AppText weight="extraBold" style={styles.title}>{t(busy ? "Setting up…" : enabled ? "Tap to Stop" : "Tap to Start")}</AppText>
          <View style={styles.soonBadge}>
            <AppText weight="bold" style={styles.soonText}>{t(enabled ? "Assistant on" : "Offline assistant")}</AppText>
          </View>
        </View>
        <AppText weight="semibold" style={styles.description}>
          {t("Get help from GabAI while using other apps on your phone.")}
        </AppText>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { borderRadius: 36, backgroundColor: homeTheme.colors.lavenderPale, boxShadow: "0 10px 24px rgba(94, 69, 141, 0.10)" },
  card: { alignItems: "center", borderRadius: 36, paddingTop: 16, paddingBottom: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.85)" },
  eyebrow: { fontSize: 13, lineHeight: 20, letterSpacing: 4, color: homeTheme.colors.muted, marginBottom: 10 },
  stage: { width: "100%", alignItems: "center" },
  halo: {
    position: "absolute", top: 10, backgroundColor: "rgba(255,255,255,0.30)",
    borderWidth: 2, borderColor: "rgba(255,255,255,0.38)",
    boxShadow: "inset 5px 5px 24px rgba(162,144,230,0.12), 0 4px 24px rgba(255,255,255,0.65)",
  },
  powerPosition: { position: "absolute", alignItems: "center" },
  titleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 16, marginTop: 4 },
  title: { fontSize: 23, lineHeight: 30, textAlign: "center" },
  description: { fontSize: 16, lineHeight: 23, textAlign: "center", color: homeTheme.colors.muted, paddingHorizontal: 20, marginTop: 8 },
  soonBadge: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 3, backgroundColor: "#E8E1FF" },
  soonText: { color: "#624C9D", fontSize: 12, lineHeight: 18 },
  orb: { position: "absolute", width: 112, height: 112, borderRadius: 56, backgroundColor: "rgba(219,210,255,0.36)" },
  topOrb: { right: -36, top: -28 },
  leftOrb: { left: -62, bottom: 72 },
  bottomOrb: { right: -30, bottom: -34, width: 136, height: 136, borderRadius: 68, backgroundColor: "rgba(255,255,255,0.35)" },
});
