import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { homeTheme } from "../../theme/home";
import { AppText } from "./AppText";

export type NoticeContent = { title: string; message: string };

type FeatureNoticeProps = { content: NoticeContent | null; onClose: () => void };

export function FeatureNotice({ content, onClose }: FeatureNoticeProps) {
  return (
    <Modal visible={content !== null} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <View style={styles.dialog} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={{ gap: 16 }}>
            <AppText weight="extraBold" accessibilityRole="header" style={styles.title}>{content?.title}</AppText>
            <AppText style={styles.message}>{content?.message}</AppText>
          </ScrollView>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Got it, close message"
            onPress={onClose}
            style={({ pressed }) => [styles.close, { opacity: pressed ? 0.75 : 1 }]}
          >
            <AppText weight="extraBold" style={styles.closeLabel}>Got it</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: homeTheme.colors.scrim },
  dialog: { width: "100%", maxWidth: 440, maxHeight: "90%", borderRadius: 28, padding: 24, gap: 16, backgroundColor: homeTheme.colors.background },
  title: { fontSize: 24, lineHeight: 32 },
  message: { fontSize: 17, lineHeight: 26, color: homeTheme.colors.muted },
  close: { minHeight: 52, borderRadius: 18, padding: 14, alignItems: "center", justifyContent: "center", backgroundColor: homeTheme.colors.purple },
  closeLabel: { fontSize: 17, lineHeight: 24, color: homeTheme.colors.white },
});
