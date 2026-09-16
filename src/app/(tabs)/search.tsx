import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Alert,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Modal,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { controlHeight, radius, spacing, typography, type ThemeColors } from "../../theme/tokens";
import { useThemeColors } from "../../hooks/useThemeColors";
import { foodSafetyStore, type FoodSafetyAnalysis } from "../../data/foodSafety";
import { HistoryItem, FoodCheckCard } from "../../components/FoodCheckCard";
import { AppButton } from "../../components/AppButton";
import { EmptyState } from "../../components/EmptyState";
import { ScreenHeader } from "../../components/ScreenHeader";
import { MedicalDisclaimer } from "../../components/MedicalDisclaimer";
import { fetchHistory, deleteAnalysis, saveAnalysis } from "../../services/historyService";

const UNDO_WINDOW_MS = 6000;
const SKELETON_ROWS = 4;

export default function SearchHistoryScreen() {
  const { colors, isDark } = useThemeColors();
  const styles = makeStyles(colors);
  const router = useRouter();
  const [history, setHistory] = useState<FoodSafetyAnalysis[]>(foodSafetyStore.getHistory());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAnalysis, setSelectedAnalysis] = useState<FoodSafetyAnalysis | null>(null);
  const [lastDeleted, setLastDeleted] = useState<FoodSafetyAnalysis | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

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

  const handleDeleteSelected = () => {
    if (!selectedAnalysis) return;
    const { id, foodName } = selectedAnalysis;
    Alert.alert(
      "Delete this check?",
      `"${foodName}" will be permanently removed from your history. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const deleted = selectedAnalysis;
            setSelectedAnalysis(null);
            setLastDeleted(null);
            if (undoTimer.current) clearTimeout(undoTimer.current);
            foodSafetyStore.removeAnalysis(id);
            try {
              await deleteAnalysis(id);
            } catch {
              /* local copy already removed */
            }
            // Completion state with a way back: Undo restores locally + re-saves.
            setLastDeleted(deleted);
            undoTimer.current = setTimeout(() => setLastDeleted(null), UNDO_WINDOW_MS);
          },
        },
      ]
    );
  };

  const handleUndoDelete = async () => {
    if (!lastDeleted) return;
    const restored = lastDeleted;
    setLastDeleted(null);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    foodSafetyStore.setHistory([restored, ...foodSafetyStore.getHistory()]);
    try {
      await saveAnalysis(restored);
    } catch {
      /* local copy already restored */
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

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

      {lastDeleted && !isLoading && (
        <View style={styles.undoBanner}>
          <Text style={styles.undoText} numberOfLines={1} ellipsizeMode="tail">
            “{lastDeleted.foodName}” deleted.
          </Text>
          <Pressable onPress={handleUndoDelete} accessibilityRole="button" accessibilityLabel="Undo delete">
            <Text style={styles.undoAction}>Undo</Text>
          </Pressable>
        </View>
      )}

      {isLoading ? (
        <View style={styles.listContent} accessibilityRole="progressbar" accessibilityLabel="Loading your previous checks">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <View key={`skeleton-${i}`} style={styles.skeletonRow}>
              <View style={styles.skeletonIcon} />
              <View style={styles.skeletonTextWrap}>
                <View style={styles.skeletonLineWide} />
                <View style={styles.skeletonLineNarrow} />
              </View>
            </View>
          ))}
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
                  <AppButton
                    label="Delete this check"
                    variant="danger"
                    onPress={handleDeleteSelected}
                    style={styles.modalDelete}
                  />
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
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
  undoBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.cardBg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  undoText: { flex: 1, minWidth: 0, fontSize: typography.bodySmall.fontSize, color: colors.slateMedium, fontWeight: "500" },
  undoAction: { fontSize: typography.bodySmall.fontSize, fontWeight: "700", color: colors.primaryText },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.cardBg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  skeletonIcon: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.bgSubtle },
  skeletonTextWrap: { flex: 1, gap: 6 },
  skeletonLineWide: { height: 12, borderRadius: 6, backgroundColor: colors.bgSubtle, width: "60%" },
  skeletonLineNarrow: { height: 10, borderRadius: 5, backgroundColor: colors.bgSubtle, width: "40%" },
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
  modalDelete: { marginTop: spacing.md },
});
