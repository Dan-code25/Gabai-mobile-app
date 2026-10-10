import { useSyncExternalStore } from "react";
import { appData } from "./appData";
export function useAppData() { return useSyncExternalStore(appData.subscribe, appData.getSnapshot, appData.getSnapshot); }
