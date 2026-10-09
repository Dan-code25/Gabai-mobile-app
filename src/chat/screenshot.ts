import * as ImagePicker from "expo-image-picker";

/** The installed Android picker already includes a free-form crop editor. */
export async function pickCroppedScreenshot(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"], allowsEditing: true, allowsMultipleSelection: false,
    quality: 1,
  });
  return result.canceled ? null : result.assets[0]?.uri ?? null;
}
