import { appData } from "../storage/appData";
import { useAppData } from "../storage/useAppData";
import { filipino, translate } from "./translations";

export function useLanguage() {
  const { language } = useAppData();
  return { language, t: (text: string) => translate(text, language), setLanguage: appData.setLanguage.bind(appData) };
}
export function nativeLabels() {
  const language = appData.getSnapshot().language;
  return Object.fromEntries(Object.keys(filipino).map(key => [key, translate(key, language)]));
}
