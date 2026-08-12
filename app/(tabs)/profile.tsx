import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "@/convex/_generated/api";
import { authClient } from "@/lib/auth-client";
import {
  nutriSafeColors,
  radii,
  spacing,
  typography,
} from "@/components/NutriSafeTheme";

type MenuItemProps = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  subtitle?: string;
  onPress?: () => void;
  danger?: boolean;
  iconBg?: string;
};

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
  danger = false,
  iconBg,
}: MenuItemProps) {
  const iconColor = danger ? nutriSafeColors.error : nutriSafeColors.primary;
  const bg = iconBg ?? (danger ? `${nutriSafeColors.error}12` : `${nutriSafeColors.primary}12`);

  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: radii.xl,
        padding: spacing.md,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        marginBottom: spacing.sm,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
      }}
      activeOpacity={0.8}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radii.lg,
          backgroundColor: bg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            ...typography.bodyMd,
            color: danger ? nutriSafeColors.error : nutriSafeColors.onSurface,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
        {subtitle && (
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              marginTop: 2,
            }}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {!danger && (
        <Ionicons
          name="chevron-forward"
          size={18}
          color={nutriSafeColors.onSurfaceVariant}
        />
      )}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const profile = useQuery(api.profile.get.get);
  const updateProfile = useAction(api.profile.update.update);
  const [loading, setLoading] = useState(false);

  const isLoading = profile === undefined;

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          setLoading(true);
          try {
            await authClient.signOut();
            router.replace("/(auth)/login");
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const conditionCount = (profile as any)?.conditions?.length ?? 0;

  // Initials
  const name = (profile as any)?.name ?? "User";
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: nutriSafeColors.background }}
      edges={["top"]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        {/* ─── Header ─── */}
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: spacing.md,
          }}
        >
          <Text
            style={{ ...typography.h2, color: nutriSafeColors.onSurface }}
          >
            Profile
          </Text>
        </View>

        {/* ─── Avatar + User Card ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            backgroundColor: "#ffffff",
            borderRadius: radii.xl,
            padding: spacing.xl,
            alignItems: "center",
            marginBottom: spacing.lg,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 8,
            elevation: 2,
          }}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color={nutriSafeColors.primary} />
          ) : (
            <>
              {/* Avatar */}
              <View
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: radii.full,
                  backgroundColor: nutriSafeColors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.md,
                  shadowColor: nutriSafeColors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 32,
                    fontWeight: "700",
                    color: "#ffffff",
                  }}
                >
                  {initials || "U"}
                </Text>
              </View>

              <Text
                style={{
                  ...typography.h3,
                  color: nutriSafeColors.onSurface,
                  marginBottom: 4,
                }}
              >
                {name}
              </Text>
              <Text
                style={{
                  ...typography.bodyMd,
                  color: nutriSafeColors.onSurfaceVariant,
                }}
              >
                {(profile as any)?.email ?? "user@example.com"}
              </Text>

              {/* Stats row */}
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.lg,
                  marginTop: spacing.lg,
                  paddingTop: spacing.lg,
                  borderTopWidth: 1,
                  borderTopColor: nutriSafeColors.outlineVariant,
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      color: nutriSafeColors.primary,
                    }}
                  >
                    {conditionCount}
                  </Text>
                  <Text
                    style={{
                      ...typography.bodySm,
                      color: nutriSafeColors.onSurfaceVariant,
                    }}
                  >
                    Conditions
                  </Text>
                </View>
                <View
                  style={{
                    width: 1,
                    backgroundColor: nutriSafeColors.outlineVariant,
                  }}
                />
                <View style={{ alignItems: "center" }}>
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: "800",
                      color: nutriSafeColors.primary,
                    }}
                  >
                    ✓
                  </Text>
                  <Text
                    style={{
                      ...typography.bodySm,
                      color: nutriSafeColors.onSurfaceVariant,
                    }}
                  >
                    Active
                  </Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* ─── Menu Sections ─── */}
        <View style={{ paddingHorizontal: spacing.lg }}>
          {/* Health */}
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.sm,
              marginLeft: 4,
            }}
          >
            Health
          </Text>

          <MenuItem
            icon="medical"
            label="Medical Profile"
            subtitle={
              conditionCount > 0
                ? `${conditionCount} conditions configured`
                : "Set up your medical conditions"
            }
            onPress={() =>
              Alert.alert("Medical Profile", "Coming soon!")
            }
            iconBg={`${nutriSafeColors.primary}12`}
          />
          <MenuItem
            icon="nutrition"
            label="Dietary Preferences"
            subtitle="Manage restrictions and allergies"
            onPress={() =>
              Alert.alert("Dietary Preferences", "Coming soon!")
            }
            iconBg={`${nutriSafeColors.secondary}12`}
          />
          <MenuItem
            icon="fitness"
            label="Health Goals"
            subtitle="Set and track your objectives"
            onPress={() => Alert.alert("Health Goals", "Coming soon!")}
            iconBg={`${nutriSafeColors.tertiary}12`}
          />

          {/* Account */}
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.sm,
              marginTop: spacing.sm,
              marginLeft: 4,
            }}
          >
            Account
          </Text>

          <MenuItem
            icon="bookmark"
            label="Saved Analyses"
            subtitle="View your food analysis history"
            onPress={() => router.push("/(tabs)/saved")}
            iconBg={`${nutriSafeColors.primary}12`}
          />
          <MenuItem
            icon="notifications"
            label="Notifications"
            subtitle="Customize alert preferences"
            onPress={() =>
              Alert.alert("Notifications", "Coming soon!")
            }
            iconBg={`${nutriSafeColors.onSurfaceVariant}12`}
          />

          {/* Support */}
          <Text
            style={{
              ...typography.bodySm,
              color: nutriSafeColors.onSurfaceVariant,
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              marginBottom: spacing.sm,
              marginTop: spacing.sm,
              marginLeft: 4,
            }}
          >
            Support
          </Text>

          <MenuItem
            icon="information-circle"
            label="About NutriSafe"
            subtitle="Version 1.0.0"
            onPress={() => Alert.alert("About NutriSafe", "v1.0.0")}
            iconBg={`${nutriSafeColors.primary}12`}
          />
          <MenuItem
            icon="help-circle"
            label="Help & Support"
            subtitle="Get help or report an issue"
            onPress={() => Alert.alert("Help", "Coming soon!")}
            iconBg={`${nutriSafeColors.secondary}12`}
          />

          {/* Sign Out */}
          <View style={{ marginTop: spacing.sm }}>
            <TouchableOpacity
              onPress={handleLogout}
              disabled={loading}
              style={{
                backgroundColor: `${nutriSafeColors.error}12`,
                borderRadius: radii.xl,
                padding: spacing.lg,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: spacing.sm,
              }}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={nutriSafeColors.error}
                />
              ) : (
                <Ionicons
                  name="log-out"
                  size={22}
                  color={nutriSafeColors.error}
                />
              )}
              <Text
                style={{
                  ...typography.bodyMd,
                  color: nutriSafeColors.error,
                  fontWeight: "700",
                }}
              >
                Log Out
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
