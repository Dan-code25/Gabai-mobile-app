import "./global.css";

import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import type { ImagePickerAsset } from "expo-image-picker";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import {
  isDocumentOcrAvailable,
  recognizeDocument,
  type OcrDocumentResult,
} from "./modules/offline-ocr";

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : null;
  return code ? `${code}: ${message}` : message;
}

export default function App() {
  const [image, setImage] = useState<ImagePickerAsset | null>(null);
  const [text, setText] = useState<string | null>(null);
  const [document, setDocument] = useState<OcrDocumentResult | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"picker" | "ocr" | null>(null);
  const inFlight = useRef(false);
  const available = isDocumentOcrAvailable();
  const disabled = busy !== null || !available;

  async function pickScreenshot() {
    if (inFlight.current || !available) return;
    inFlight.current = true;
    setBusy("picker");
    setError(null);
    try {
      // Delay native picker lookup so an older build can show the rebuild message.
      const ImagePicker = await import("expo-image-picker");
      // Android's system photo picker grants access to the chosen image.
      // Crop a local copy; no broad permission, base64 conversion, or upload.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        // Omit aspect: Android's crop rectangle can fit a tall document.
        allowsEditing: true,
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (!result.canceled) {
        const selected = result.assets[0];
        if (!selected?.uri) throw new Error("The gallery returned no image URI.");
        setImage(selected);
        setText(null);
        setDocument(null);
        setShowOriginal(false);
      }
    } catch (pickerError) {
      setError(errorMessage(pickerError));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  async function extractText() {
    if (!image || inFlight.current || !available) return;
    inFlight.current = true;
    setBusy("ocr");
    setError(null);
    setText(null);
    setDocument(null);
    setShowOriginal(false);
    try {
      const result = await recognizeDocument(image.uri);
      setDocument(result);
      setText(result.text);
    } catch (ocrError) {
      setError(errorMessage(ocrError));
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1 }} className="bg-slate-50">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 16 }}>
          <Text accessibilityRole="header" className="text-3xl font-bold text-slate-900">
            GabayAI offline OCR
          </Text>
          <Text className="text-base leading-6 text-slate-700">
            Choose a screenshot, then crop to the document text. Leave out the
            clock, navigation buttons, and editor toolbar. Recognition runs on
            your phone.
          </Text>

          {!available && (
            <Text accessibilityRole="alert" className="text-base leading-6 text-red-800">
              {Platform.OS !== "android"
                ? "This proof of concept supports Android only."
                : "This app needs the updated OCR build. Rebuild with npx expo run:android and open the rebuilt app. Expo Go cannot run this test."}
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled, busy: busy === "picker" }}
            disabled={disabled}
            onPress={pickScreenshot}
            style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}
            className="min-h-12 justify-center rounded-xl border border-blue-700 bg-white px-4 py-3"
          >
            <Text className="text-center text-base font-semibold text-blue-800">
              {busy === "picker" ? "Choosing document…" : "Choose and crop screenshot"}
            </Text>
          </Pressable>

          {image && (
            <View className="gap-2">
              <Image
                source={{ uri: image.uri }}
                resizeMode="contain"
                accessibilityLabel="Cropped document for text recognition"
                className="h-64 w-full rounded-xl bg-slate-200"
                onError={() => setError("Could not preview the selected image. Try another screenshot.")}
              />
              <Text className="text-base text-slate-700">
                {image.fileName || "Selected image"} · {image.width} × {image.height}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || !image, busy: busy === "ocr" }}
            disabled={disabled || !image}
            onPress={extractText}
            style={({ pressed }) => ({ opacity: disabled || !image ? 0.45 : pressed ? 0.75 : 1 })}
            className="min-h-12 justify-center rounded-xl bg-blue-700 px-4 py-3"
          >
            <Text className="text-center text-base font-semibold text-white">
              {busy === "ocr" ? "Extracting text…" : "Extract text"}
            </Text>
          </Pressable>

          {busy === "ocr" && <ActivityIndicator size="large" accessibilityLabel="Extracting text" />}
          {error && (
            <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" selectable className="text-base leading-6 text-red-800">
              {error}
            </Text>
          )}
          <View className="gap-2 rounded-xl border border-slate-300 bg-white p-4">
            <Text accessibilityRole="header" className="text-lg font-semibold text-slate-900">
              Extracted text
            </Text>
            {document?.text.trim() ? (
              <>
                <Text className="text-base leading-6 text-slate-700">
                  Review and edit any mistakes. Symbols and spelling are kept as
                  recognized; text blocks are separated for readability.
                </Text>
                <TextInput
                  accessibilityLabel="Extracted text"
                  accessibilityHint="Edit recognition mistakes before using this text."
                  multiline
                  scrollEnabled={false}
                  editable={!disabled}
                  autoCorrect={false}
                  value={text ?? ""}
                  onChangeText={setText}
                  style={{ minHeight: 160, textAlignVertical: "top" }}
                  className="rounded-lg border border-blue-700 bg-white p-3 text-base leading-6 text-slate-900"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: disabled || text === document.text }}
                  disabled={disabled || text === document.text}
                  onPress={() => setText(document.text)}
                  style={({ pressed }) => ({ opacity: disabled || text === document.text ? 0.45 : pressed ? 0.75 : 1 })}
                  className="min-h-12 justify-center rounded-lg border border-blue-700 px-3 py-2"
                >
                  <Text className="text-center text-base font-semibold text-blue-800">Reset text edits</Text>
                </Pressable>
              </>
            ) : (
              <Text selectable accessibilityLiveRegion="polite" className="text-base leading-6 text-slate-800">
                {text === null
                  ? "Your result will appear here."
                  : "No text found. Try a sharper screenshot with larger text, or include more of the document in your crop."}
              </Text>
            )}
            {document && (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled, expanded: showOriginal }}
                  disabled={disabled}
                  onPress={() => setShowOriginal((shown) => !shown)}
                  style={({ pressed }) => ({ opacity: disabled ? 0.45 : pressed ? 0.75 : 1 })}
                  className="min-h-12 justify-center rounded-lg border border-blue-700 px-3 py-2"
                >
                  <Text className="text-center text-base font-semibold text-blue-800">
                    {showOriginal ? "Hide original recognition" : "Show original recognition"}
                  </Text>
                </Pressable>
                {showOriginal && (
                  <Text selectable className="text-base leading-6 text-slate-800">
                    {document.rawText || "No text was recognized in this crop."}
                  </Text>
                )}
              </>
            )}
          </View>
          <Text className="text-base leading-6 text-slate-700">
            Offline check: use the release test build, turn on airplane mode,
            switch Wi-Fi off, and repeat with a local screenshot.
          </Text>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
