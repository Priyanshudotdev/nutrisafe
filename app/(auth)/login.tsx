import React, { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert , TouchableOpacity, TextInput } from "react-native";
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
      
      // On success, redirect back to index so the state machine can route to Profile or Tabs
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
      className="flex-1 bg-background"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <View className="mb-10">
          <Text className="text-5xl font-black text-foreground tracking-tight">
            NutriSafe
          </Text>
          <Text className="text-xl text-default-500 mt-2 font-medium">
            {isSignUp ? "Create your account" : "Welcome back"}
          </Text>
        </View>

        <View className="flex flex-col gap-5">
          {isSignUp && (
            <View>
              <Text className="font-bold text-foreground mb-1">Full Name</Text>
              <TextInput className="border border-default-200 rounded-xl p-4 bg-default-50 text-foreground mt-1 mb-3" placeholderTextColor="#888"
                placeholder="Enter your name"
                value={name}
                onChangeText={setName}
              />
            </View>
          )}
          <View>
            <Text className="font-bold text-foreground mb-1">Email</Text>
            <TextInput className="border border-default-200 rounded-xl p-4 bg-default-50 text-foreground mt-1 mb-3" placeholderTextColor="#888"
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View>
            <Text className="font-bold text-foreground mb-1">Password</Text>
            <TextInput className="border border-default-200 rounded-xl p-4 bg-default-50 text-foreground mt-1 mb-3" placeholderTextColor="#888"
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity className="mt-4 bg-primary shadow-lg shadow-primary/30 items-center justify-center p-4 rounded-xl"
            size="lg"
            onPress={handleAuth}
            
          >
            <Text className="text-white font-bold">{isSignUp ? "Sign Up" : "Sign In"}</Text>
          </TouchableOpacity>

          <TouchableOpacity className="mt-2 bg-transparent items-center justify-center p-4 rounded-xl" 
            onPress={() => setIsSignUp(!isSignUp)}
            
          >
            <Text className="text-primary">{isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
