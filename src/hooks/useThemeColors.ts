import { useSyncExternalStore } from "react";
import { useColorScheme } from "react-native";
import { colors as lightColors } from "../theme/tokens";
import { darkColors } from "../theme/darkTokens";
import { themeStore } from "../services/themeStore";

function subscribe(cb: () => void) { return themeStore.subscribe(cb); }
function getSnapshot() { return themeStore.getMode(); }

/**
 * Returns merged color tokens that respond to the current theme mode.
 * Use this instead of importing `colors` directly from tokens.
 */
export function useThemeColors() {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const systemScheme = useColorScheme();
  const effective = themeStore.resolve(systemScheme);
  const isDark = effective === "dark";

  const themeColors = isDark
    ? { ...lightColors, ...darkColors }
    : lightColors;

  return { colors: themeColors, isDark };
}
