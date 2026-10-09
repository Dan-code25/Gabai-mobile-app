import { router } from "expo-router";
import type { HomeTab } from "../components/home/BottomNavigation";
export function openTab(tab: HomeTab) {
  const routes = { Home: "/", Chat: "/chat", History: "/history", Settings: "/settings" } as const;
  router.replace(routes[tab]);
}
