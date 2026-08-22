import React from "react";
import { Redirect } from "expo-router";

/** Legacy route — Settings merged into Account. */
export default function SettingsRedirect() {
  return <Redirect href="/(tabs)/account" />;
}
