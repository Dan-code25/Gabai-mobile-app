import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, Image, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { homeTheme } from "../theme/home";
import { FloatingAssistantBridge } from "../floating-assistant/FloatingAssistantBridge";
import { ChatProvider } from "../chat/ChatProvider";
import { useEffect } from "react";
import { appData } from "../storage/appData";
import { useAppData } from "../storage/useAppData";
import { translate } from "../i18n/translations";

export default function RootLayout() {
  const data = useAppData();
  useEffect(() => { void appData.load(); }, []);
  const [fontsLoaded, fontError] = useFonts({
    "Nunito-Regular": require("../../assets/fonts/Nunito-Regular.ttf"),
    "Nunito-SemiBold": require("../../assets/fonts/Nunito-SemiBold.ttf"),
    "Nunito-Bold": require("../../assets/fonts/Nunito-Bold.ttf"),
    "Nunito-ExtraBold": require("../../assets/fonts/Nunito-ExtraBold.ttf"),
    ...Ionicons.font,
  });

  if (fontError) throw fontError;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {fontsLoaded && data.ready ? (
        <ChatProvider><FloatingAssistantBridge /><Slot /></ChatProvider>
      ) : (
        <View className="flex-1 items-center justify-center gap-6 bg-gabai-cream">
          <Image
            source={require("../../assets/images/gabai-logo.png")}
            accessibilityLabel="GabAI"
            style={{ width: 80, height: 80, borderRadius: 24 }}
          />
          <ActivityIndicator
            color={homeTheme.colors.purple}
            accessibilityLabel={translate("Loading GabAI", data.language)}
          />
        </View>
      )}
    </SafeAreaProvider>
  );
}
