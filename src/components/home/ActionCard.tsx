import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, View } from "react-native";

import { homeTheme } from "../../theme/home";
import { AppText } from "../ui/AppText";

type ActionCardProps = {
  title: string;
  description: string;
  icon: "camera" | "chatbubble-ellipses";
  tone: "purple" | "coral";
  onPress: () => void;
  stacked?: boolean;
};

export function ActionCard({ title, description, icon, tone, onPress, stacked }: ActionCardProps) {
  const purple = tone === "purple";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={`${description} This feature is coming soon.`}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
    >
      <LinearGradient
        colors={purple ? ["#EFEAFF", "#EAE5FF"] : ["#FFEAE5", "#FFE5E5"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[styles.card, stacked && styles.stacked]}
      >
        <View style={[styles.iconShadow, { backgroundColor: purple ? homeTheme.colors.purple : homeTheme.colors.coral }]}>
          <LinearGradient
            colors={purple ? ["#9580FF", "#7052F7", "#5635E7"] : ["#FF9A83", "#FF735C", "#FF624B"]}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.iconSurface}
          >
            <Ionicons name={icon} size={34} color={homeTheme.colors.white} accessible={false} />
          </LinearGradient>
        </View>
        <View className="flex-1 gap-1" style={stacked && styles.stackedText}>
          <AppText weight="extraBold" style={styles.title}>{title}</AppText>
          <AppText weight="semibold" style={styles.description}>{description}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={22} color={homeTheme.colors.muted} accessible={false} style={stacked && styles.stackedChevron} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: "row", alignItems: "center", minHeight: 98, padding: 14, gap: 16, borderRadius: 28 },
  stacked: { flexDirection: "column", alignItems: "flex-start", gap: 12, padding: 20 },
  stackedText: { flex: 0, width: "100%", paddingRight: 10 },
  stackedChevron: { position: "absolute", top: 40, right: 20 },
  iconShadow: { width: 64, height: 64, borderRadius: 20, paddingBottom: 3, boxShadow: "0 4px 10px rgba(117,73,167,0.15)" },
  iconSurface: { flex: 1, borderRadius: 20, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  title: { fontSize: 17, lineHeight: 23 },
  description: { fontSize: 16, lineHeight: 22, color: homeTheme.colors.muted },
});
