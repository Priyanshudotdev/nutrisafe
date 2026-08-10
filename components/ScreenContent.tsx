import React from "react";
import { Text, View } from "react-native";
import { tw } from "uniwind";

import { EditScreenInfo } from "./EditScreenInfo";

interface ScreenContentProps {
  title: string;
  path: string;
  children?: React.ReactNode;
}

export const ScreenContent: React.FC<ScreenContentProps> = ({ title, path, children }) => {
  return (
    <View className={tw("items-center flex-1 justify-center bg-white")}>
      <Text className={tw("text-xl font-bold")}>{title}</Text>
      <View className={tw("h-[1px] my-7 w-4/5 bg-gray-200")} />
      <EditScreenInfo path={path} />
      {children}
    </View>
  );
};
