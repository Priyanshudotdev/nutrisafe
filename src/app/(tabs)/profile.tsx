import React from "react";
import { Redirect } from "expo-router";

/** Legacy route — Profile merged into Account. */
export default function ProfileRedirect() {
  return <Redirect href="/(tabs)/account" />;
}
