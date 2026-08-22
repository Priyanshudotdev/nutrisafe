import { useCallback, useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { themeStore, type ThemeMode } from "../services/themeStore";

function getSnapshot() {
  return themeStore.getMode();
}
function subscribe(cb: () => void) {
  return themeStore.subscribe(cb);
}

/** Returns current resolved scheme ("light" | "dark") and a setter. */
export function useTheme() {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const systemScheme = useColorScheme();
  const effectiveScheme = themeStore.resolve(systemScheme);

  const setMode = useCallback((m: ThemeMode) => themeStore.setMode(m), []);

  return { mode, effectiveScheme, isDark: effectiveScheme === "dark", setMode };
}
