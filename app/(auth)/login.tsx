import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  TextInput,
} from "react-native";
import { Button } from "heroui-native/button";
import { useRouter } from "expo-router";
import { authClient } from "@/lib/auth-client";

export default function LoginScreen() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (!email || !password || (isSignUp && !name)) {
      Alert.alert("Error", "Please fill in all fields.");
      return;
    }

    setLoading(true);
    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await authClient.signIn.email({
          email,
          password,
        });
        if (error) throw new Error(error.message);
      }

      // Ensure the session atom and Convex provider have the new session before routing.
      const { data: session, error: sessionError } = await authClient.getSession({
        fetchOptions: { throw: false },
      });
      if (sessionError || !session?.session) {
        throw new Error("Authentication succeeded, but the session could not be loaded.");
      }

      router.replace("/");
    } catch (e: any) {
      Alert.alert("Authentication Failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="bg-background flex-1">
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <View className="mb-10">
          <Text className="text-foreground text-5xl font-black tracking-tight">NutriSafe</Text>
          <Text className="text-default-500 mt-2 text-xl font-medium">
            {isSignUp ? "Create your account" : "Welcome back"}
          </Text>
        </View>

        <View className="flex flex-col gap-5">
          {isSignUp && (
            <View>
              <Text className="text-foreground mb-1 font-bold">Full Name</Text>
              <TextInput
                className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
                placeholderTextColor="#888"
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
              />
            </View>
          )}
          <View>
            <Text className="text-foreground mb-1 font-bold">Email</Text>
            <TextInput
              className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
              placeholderTextColor="#888"
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View>
            <Text className="text-foreground mb-1 font-bold">Password</Text>
            <TextInput
              className="border-default-200 bg-default-50 text-foreground mb-3 mt-1 rounded-xl border p-4"
              placeholderTextColor="#888"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Button
            size="lg"
            variant="primary"
            className="mt-4"
            isDisabled={loading}
            onPress={handleAuth}>
            {loading ? "Please wait…" : isSignUp ? "Sign Up" : "Sign In"}
          </Button>

          <Pressable
            className="mt-2 items-center py-3"
            accessibilityRole="button"
            onPress={() => setIsSignUp(!isSignUp)}>
            <Text className="font-semibold" style={{ color: "#4f46e5" }}>
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
