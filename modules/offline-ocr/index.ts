import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

import { prepareDocumentText, type OcrDocumentResult, type OcrResult } from "./document";

export { prepareDocumentText } from "./document";
export type { OcrBounds, OcrLine, OcrBlock, OcrResult, OcrDocumentResult } from "./document";

type OfflineOcrModule = {
  recognizeText(imageUri: string): Promise<string>;
  recognizeDocument?: (imageUri: string) => Promise<OcrResult>;
};

// Optional lookup lets older builds / Expo Go show an explanation at startup.
const nativeModule =
  Platform.OS === "android"
    ? requireOptionalNativeModule<OfflineOcrModule>("OfflineOcr")
    : null;

export function isOfflineOcrAvailable(): boolean {
  return nativeModule !== null;
}

export function isDocumentOcrAvailable(): boolean {
  return typeof nativeModule?.recognizeDocument === "function";
}

function requireOcr(): OfflineOcrModule {
  if (Platform.OS !== "android") {
    throw new Error("This offline OCR proof of concept supports Android only.");
  }
  if (!nativeModule) {
    throw new Error(
      "OfflineOcr is missing from this build. Rebuild the Android app with npx expo run:android. Expo Go cannot load this module.",
    );
  }
  return nativeModule;
}

export async function recognizeText(imageUri: string): Promise<string> {
  return requireOcr().recognizeText(imageUri);
}

/** Recognize a local (preferably cropped) image, retaining the raw text/layout. */
export async function recognizeDocument(imageUri: string): Promise<OcrDocumentResult> {
  const module = requireOcr();
  if (typeof module.recognizeDocument !== "function") {
    throw new Error(
      "This build has an older OCR module. Rebuild with npx expo run:android to use document recognition.",
    );
  }
  const result = await module.recognizeDocument(imageUri);
  return { ...result, text: prepareDocumentText(result) };
}
