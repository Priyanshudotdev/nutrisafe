import React, { useState } from "react";
import { View, Text, Image, ScrollView, ActivityIndicator, Alert , TouchableOpacity, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useRouter } from "expo-router";

export default function CameraScreen() {
  const router = useRouter();
  const identifyFood = useAction(api.ai.identify.identify);
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [identifiedResult, setIdentifiedResult] = useState<any>(null);

  const requestPermissionAndScan = async (source: "camera" | "gallery") => {
    let result;
    if (source === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Camera permission is required to scan food.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Gallery permission is required to select photos.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
    }

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      handleIdentify(result.assets[0].base64);
    }
  };

  const handleIdentify = async (base64String: string) => {
    setIdentifying(true);
    setIdentifiedResult(null);
    try {
      // Assuming a generic jpeg mime type from image picker base64
      const result = await identifyFood({ 
        imageBase64: base64String, 
        mimeType: "image/jpeg" 
      });
      setIdentifiedResult(result);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Identification Failed", e.message);
    } finally {
      setIdentifying(false);
    }
  };

  return (
    <View className="flex-1 bg-background p-6">
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text className="text-3xl font-extrabold text-foreground mb-2 mt-4">
          Scan Food
        </Text>
        <Text className="text-default-500 mb-8">
          Take a photo of any food to instantly identify and analyze it.
        </Text>

        <View className="flex flex-col gap-4 mb-8">
          <TouchableOpacity 
            size="lg" 
            color="primary" 
            onPress={() => requestPermissionAndScan("camera")}
            className="shadow-lg shadow-primary/20"
          >
            Take a Photo
          </TouchableOpacity>
          <TouchableOpacity 
            size="lg" 
            variant="flat" 
            onPress={() => requestPermissionAndScan("gallery")}
          >
            Upload from Gallery
          </TouchableOpacity>
        </View>

        {imageUri && (
          <View className="items-center mb-6">
            <Image 
              source={{ uri: imageUri }} 
              className="w-64 h-64 rounded-3xl"
              resizeMode="cover"
            />
          </View>
        )}

        {identifying && (
          <View className="items-center justify-center p-6 bg-content1 rounded-2xl border border-default-100 shadow-sm mt-4">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="mt-4 text-foreground font-semibold">Vision AI is identifying food...</Text>
          </View>
        )}

        {identifiedResult && !identifying && (
          <View className="p-6 bg-content1 rounded-2xl shadow-lg border border-default-200 items-center">
            <Text className="text-default-500 mb-1">Identified as:</Text>
            <Text className="text-2xl font-black text-foreground mb-4">
              {identifiedResult.identifiedName}
            </Text>

            {identifiedResult.matchFound ? (
              <View className="w-full flex flex-col gap-3">
                <View className="bg-success/20 p-3 rounded-xl mb-2 items-center">
                  <Text className="text-success-700 font-bold">Match found in database!</Text>
                </View>
                <TouchableOpacity className="bg-primary w-full items-center justify-center p-4 rounded-xl"
                  size="lg"
                  onPress={() => {
                    Alert.alert("Analyze", `Food ID: ${identifiedResult.foodId}`);
                  }}
                >
                  <Text className="text-white font-bold">Analyze Medical Compatibility</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View className="w-full bg-danger/10 p-4 rounded-xl items-center">
                <Text className="text-danger-700 font-bold mb-1">No exact match found.</Text>
                <Text className="text-danger-600 text-sm text-center">
                  We identified the food, but we don&apos;t have its verified nutritional profile in our local clinical database yet.
                </Text>
              </View>
            )}
            
            <TouchableOpacity className="mt-6 w-full bg-default-200 items-center justify-center p-4 rounded-xl"
              onPress={() => {
                setImageUri(null);
                setIdentifiedResult(null);
              }}
            >
              <Text className="text-default-700 font-bold">Try Another Photo</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
