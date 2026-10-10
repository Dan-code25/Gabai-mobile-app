import { NativeModule, requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type FloatingAction =
  | { type: "enabled" | "stopped" }
  | { type: "crop"; conversationId: string; uri: string }
  | { type: "question"; conversationId: string; text: string };

type Events = { onAction: (event: FloatingAction) => void };
declare class FloatingModule extends NativeModule<Events> {
  isEnabled(): boolean;
  requestOverlayPermission(): Promise<boolean>;
  start(): Promise<void>;
  stop(): Promise<void>;
  updateChat(snapshot: string): Promise<void>;
  discardCapture(uri: string): Promise<void>;
}

export const floatingAssistant = Platform.OS === "android"
  ? requireOptionalNativeModule<FloatingModule>("FloatingAssistant")
  : null;
