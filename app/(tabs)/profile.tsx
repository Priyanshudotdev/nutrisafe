import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { useQuery, useMutation, useAction } from "convex/react";
import { router } from "expo-router";
import { api } from "@/convex/_generated/api";
import { nutriSafeColors, radii, spacing, typography } from "@/components/NutriSafeTheme";
import { MaterialIcon } from "@/components/NutriSafeComponents";
import { Button } from "@/components/NutriSafeComponents";

export default function ProfileScreen() {
  const profile = useQuery(api.profile.get.get);
  const updateProfile = useAction(api.profile.update.update);
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          try {
            await updateProfile({ signedOut: true });
            router.replace("/(auth)/login");
          } catch (e: any) {
            console.error(e);
            Alert.alert("Error", e.message);
          }
        },
      },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: nutriSafeColors.background }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View
          style={{
            backgroundColor: nutriSafeColors.primary,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xl,
          }}
        >
          <Text style={typography.h2} className="text-on-primary">
            My Profile
          </Text>
          <Text style={typography.bodyMd} className="text-on-primary opacity-90">
            Manage your preferences and settings
          </Text>
        </View>

        {/* User Info */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xl,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: radii.full,
              backgroundColor: nutriSafeColors.primaryContainer,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <MaterialIcon
              name="person"
              size={40}
              color={nutriSafeColors.onPrimaryContainer}
              filled
            />
          </View>
          <Text
            style={typography.h3}
            className="text-on-surface mt-md font-semibold"
          >
            {profile?.name || "User"}
          </Text>
          <Text
            style={typography.bodyMd}
            className="text-on-surface-variant"
          >
            {profile?.email || "user@example.com"}
          </Text>
        </View>

        {/* Menu Items */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.lg,
            gap: spacing.sm,
          }}
        >
          <TouchableOpacity
            onPress={() => Alert.alert("Feature", "Medical profile coming soon")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.lg,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                backgroundColor: `${nutriSafeColors.primary}1a`,
                borderRadius: radii.md,
                padding: spacing.sm,
              }}
            >
              <MaterialIcon name="medical_services" size={24} color={nutriSafeColors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyMd} className="text-on-surface font-semibold">
                Medical Profile
              </Text>
              <Text style={typography.bodySm} className="text-on-surface-variant">
                {profile?.medicalConditions?.length > 0 ? `${profile.medicalConditions.length} conditions` : "Not configured"}
              </Text>
            </View>
            <MaterialIcon
              name="chevron_right"
              size={20}
              color={nutriSafeColors.onSurfaceVariant}
              filled
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert("Feature", "Dietary preferences coming soon")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.lg,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                backgroundColor: `${nutriSafeColors.secondary}1a`,
                borderRadius: radii.md,
                padding: spacing.sm,
              }}
            >
              <MaterialIcon name="restaurant" size={24} color={nutriSafeColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyMd} className="text-on-surface font-semibold">
                Dietary Preferences
              </Text>
              <Text style={typography.bodySm} className="text-on-surface-variant">
                Manage your dietary restrictions
              </Text>
            </View>
            <MaterialIcon
              name="chevron_right"
              size={20}
              color={nutriSafeColors.onSurfaceVariant}
              filled
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert("Feature", "Goals coming soon")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.lg,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                backgroundColor: `${nutriSafeColors.tertiary}1a`,
                borderRadius: radii.md,
                padding: spacing.sm,
              }}
            >
              <MaterialIcon name="target" size={24} color={nutriSafeColors.tertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyMd} className="text-on-surface font-semibold">
                Health Goals
              </Text>
              <Text style={typography.bodySm} className="text-on-surface-variant">
                Set and track your health objectives
              </Text>
            </View>
            <MaterialIcon
              name="chevron_right"
              size={20}
              color={nutriSafeColors.onSurfaceVariant}
              filled
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert("Feature", "Notifications coming soon")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainerLowest,
              borderRadius: radii.lg,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <View
              style={{
                backgroundColor: `${nutriSafeColors.onSurfaceVariant}1a`,
                borderRadius: radii.md,
                padding: spacing.sm,
              }}
            >
              <MaterialIcon name="notifications" size={24} color={nutriSafeColors.onSurfaceVariant} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={typography.bodyMd} className="text-on-surface font-semibold">
                Notifications
              </Text>
              <Text style={typography.bodySm} className="text-on-surface-variant">
                Customize alert preferences
              </Text>
            </View>
            <MaterialIcon
              name="chevron_right"
              size={20}
              color={nutriSafeColors.onSurfaceVariant}
              filled
            />
          </TouchableOpacity>
        </View>

        {/* Action Buttons */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xl,
            gap: spacing.sm,
          }}
        >
          <TouchableOpacity
            onPress={() => Alert.alert("Feature", "About coming soon")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainer,
              borderRadius: radii.lg,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <MaterialIcon name="info" size={24} color={nutriSafeColors.onSurface} />
            <Text style={typography.bodyMd} className="text-on-surface font-semibold">
              About NutriSafe
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => Alert.alert("Feature", "Help coming soon")}
            style={{
              backgroundColor: nutriSafeColors.surfaceContainer,
              borderRadius: radii.lg,
              padding: spacing.md,
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
            }}
          >
            <MaterialIcon name="help" size={24} color={nutriSafeColors.onSurface} />
            <Text style={typography.bodyMd} className="text-on-surface font-semibold">
              Help & Support
            </Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xl,
            marginBottom: spacing.lg,
          }}
        >
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: `${nutriSafeColors.error}1a`,
              borderRadius: radii.lg,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing.sm,
            }}
          >
            <MaterialIcon name="logout" size={24} color={nutriSafeColors.error} />
            <Text style={typography.bodyMd} className="text-error font-semibold">
              Logout
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
