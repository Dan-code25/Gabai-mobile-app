import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { floatingAssistant } from "../../modules/floating-assistant";
import { getSavedModel, importModel, isLocalAiAvailable } from "../local-ai/runtime";

export function useFloatingAssistant() {
  const [enabled, setEnabled] = useState(() => floatingAssistant?.isEnabled() ?? false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);

  useEffect(() => {
    const action = floatingAssistant?.addListener("onAction", event => {
      if (event.type === "enabled") setEnabled(true);
      if (event.type === "stopped") setEnabled(false);
    });
    const activity = AppState.addEventListener("change", state => {
      if (state === "active") setEnabled(floatingAssistant?.isEnabled() ?? false);
    });
    return () => { action?.remove(); activity.remove(); };
  }, []);

  async function toggle() {
    if (pending.current) return;
    pending.current = true; setBusy(true);
    try {
      if (!floatingAssistant) throw new Error("Rebuild the Android app once to install the floating assistant.");
      if (floatingAssistant.isEnabled()) { await floatingAssistant.stop(); setEnabled(false); return; }
      if (!isLocalAiAvailable()) throw new Error("Local AI is missing from this Android build.");
      if (!getSavedModel() && !await importModel()) return;
      if (!await floatingAssistant.requestOverlayPermission()) throw new Error("Allow GabAI to display over other apps, then tap the power button again.");
      await floatingAssistant.start();
    } finally { pending.current = false; setBusy(false); }
  }
  return { enabled, busy, toggle };
}
