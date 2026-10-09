import { useEffect } from "react";
import { connectFloatingAssistant } from "./controller";

export function FloatingAssistantBridge() {
  useEffect(connectFloatingAssistant, []);
  return null;
}
