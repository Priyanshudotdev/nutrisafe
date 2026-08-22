import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, controlHeight, radius, spacing, typography } from "../../theme/tokens";
import { foodSafetyStore, type FoodSafetyAnalysis } from "../../data/foodSafety";
import { HistoryItem, FoodCheckCard } from "../../components/FoodCheckCard";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { MedicalDisclaimer } from "../../components/MedicalDisclaimer";
import { fetchHistory } from "../../services/historyService";

export default function SearchHistoryScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<FoodSafetyAnalysis[]>(foodSafetyStore.getHistory());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState<FoodSafetyAnalysis | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => setIsLoading(false), 300);

    (async () => {
      try {
        const remote = await fetchHistory();
        if (!cancelled && remote.length >= 0) {
          foodSafetyStore.setHistory(remote);
          setHistory(remote);
        }
      } catch {
        /* keep local */
      }
    })();

    const unsubscribe = foodSafetyStore.subscribe(() => {
      setHistory(foodSafetyStore.getHistory());
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return history;
    return history.filter((item) =>
      item.foodName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [history, searchQuery]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" />

      <ScreenHeader title="History" />

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.slateMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search past checks..."
            placeholderTextColor={colors.slateMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            accessibilityLabel="Search history"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery("")} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.slateMuted} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="small" color={colors.primaryDark} />
          <Text style={styles.loadingText}>Loading your previous checks…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {filteredHistory.length > 0 ? (
            filteredHistory.map((item) => (
              <HistoryItem key={item.id} analysis={item} onPress={() => setSelectedAnalysis(item)} />
            ))
          ) : history.length === 0 ? (
            <EmptyState
              icon="time-outline"
              title="You haven't checked any foods yet"
              subtitle="Your food analyses will appear here once you check your first food."
              actionLabel="Check your first food"
              onAction={() => router.push("/(tabs)")}
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No checks found"
              subtitle="Try a different search term."
            />
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}

      <Modal
        visible={selectedAnalysis !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedAnalysis(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Food Analysis</Text>
              <Pressable onPress={() => setSelectedAnalysis(null)} accessibilityLabel="Close">
                <Ionicons name="close-circle" size={28} color={colors.slateMedium} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedAnalysis && (
                <>
                  <FoodCheckCard analysis={selectedAnalysis} expanded />
                  <View style={styles.modalDisclaimer}>
                    <MedicalDisclaimer />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: { paddingHorizontal: spacing.xl, marginBottom: spacing.sm },
  searchBar: {
    flexDirection: "row",
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 14,
    alignItems: "center",
    height: controlHeight.md,
  },
  searchInput: { flex: 1, marginLeft: spacing.sm, fontSize: typography.bodySmall.fontSize, color: colors.dark },
  loadingState: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  loadingText: { fontSize: typography.bodySmall.fontSize, color: colors.slateMuted, fontWeight: "500" },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  bottomSpacer: { height: 100 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: 40,
    maxHeight: "90%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  modalTitle: { fontSize: typography.subheading.fontSize, fontWeight: "700", color: colors.dark, letterSpacing: -0.2 },
  modalDisclaimer: { marginTop: spacing.lg },
});
