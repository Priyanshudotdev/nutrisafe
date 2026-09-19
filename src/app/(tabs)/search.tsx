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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAnalysis = useMemo(
    () => history.find((h) => h.id === selectedId) ?? null,
    [history, selectedId]
  );
  const [undoItems, setUndoItems] = useState<FoodSafetyAnalysis[]>([]);
  const pendingDeletes = useRef(
    new Map<string, { analysis: FoodSafetyAnalysis; timer: ReturnType<typeof setTimeout> }>()
  );

  useEffect(() => {
    // Capture the ref value: by cleanup time the ref object may point at a
    // different map instance, orphaning the pending undo timers.
    const pending = pendingDeletes.current;
    return () => {
      pending.forEach((entry) => clearTimeout(entry.timer));
      pending.clear();
    };
  }, []);

  // Modal derives from history: when the selected item disappears
  // (deleted/undone), selectedAnalysis becomes null and the modal closes.
  const visible = selectedAnalysis !== null;

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => setIsLoading(false), 300);

    (async () => {
      try {
        const remote = await fetchHistory();
        if (cancelled || remote === null) return;
        const local = foodSafetyStore.getHistory();
        const remoteIds = new Set(remote.map((r) => r.id));
        const localOnly = local.filter((l) => !remoteIds.has(l.id));
        const merged = [...localOnly, ...remote];
        foodSafetyStore.setHistory(merged);
        if (!cancelled) setHistory(merged);
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

  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filteredHistory = useMemo(() => {
    const q = normalize(searchQuery.trim());
    if (!q) return history;
    return history.filter((item) =>
      normalize(
        [item.foodName, item.category, item.statusHeadline, item.summary].filter(Boolean).join(" ")
      ).includes(q)
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
            const snapshot = foodSafetyStore.getHistory();
            setSelectedId(null);
            const existing = pendingDeletes.current.get(id);
            if (existing) clearTimeout(existing.timer);
            pendingDeletes.current.delete(id);
            setUndoItems((prev) => prev.filter((i) => i.id !== id));
            foodSafetyStore.removeAnalysis(id);
            try {
              await deleteAnalysis(id);
            } catch {
              // Roll back to the snapshot if the server delete failed.
              foodSafetyStore.setHistory(snapshot);
              setHistory(snapshot);
              return;
            }
            // Completion state with a way back: Undo restores locally + re-saves.
            const timer = setTimeout(() => {
              pendingDeletes.current.delete(id);
              setUndoItems((prev) => prev.filter((i) => i.id !== id));
            }, UNDO_WINDOW_MS);
            pendingDeletes.current.set(id, { analysis: deleted, timer });
            setUndoItems((prev) => [deleted, ...prev.filter((i) => i.id !== id)]);
          },
        },
      ]
    );
  };

  const handleUndoDelete = async (id: string) => {
    const pending = pendingDeletes.current.get(id);
    const restored = pending?.analysis ?? undoItems.find((i) => i.id === id);
    if (!restored) return;
    if (pending) clearTimeout(pending.timer);
    pendingDeletes.current.delete(id);
    setUndoItems((prev) => prev.filter((i) => i.id !== id));
    const snapshot = foodSafetyStore.getHistory();
    foodSafetyStore.setHistory([restored, ...foodSafetyStore.getHistory()]);
    try {
      await saveAnalysis(restored);
    } catch {
      // Local copy already restored; roll back only if the store changed unexpectedly.
      const current = foodSafetyStore.getHistory();
      if (!current.some((a) => a.id === restored.id)) {
        foodSafetyStore.setHistory(snapshot);
      }
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

      {undoItems.length > 0 && !isLoading && (
        <View>
          {undoItems.map((item) => (
            <View key={item.id} style={styles.undoBanner}>
              <Text style={styles.undoText} numberOfLines={1} ellipsizeMode="tail">
                “{item.foodName}” deleted.
              </Text>
              <Pressable
                onPress={() => handleUndoDelete(item.id)}
                accessibilityRole="button"
                accessibilityLabel={`Undo delete ${item.foodName}`}
              >
                <Text style={styles.undoAction}>Undo</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {isLoading ? (
        <View
          style={styles.listContent}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading your previous checks"
        >
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
              <HistoryItem key={item.id} analysis={item} onPress={() => setSelectedId(item.id)} />
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
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Food Analysis</Text>
              <Pressable onPress={() => setSelectedId(null)} accessibilityLabel="Close">
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

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
    searchInput: {
      flex: 1,
      marginLeft: spacing.sm,
      fontSize: typography.bodySmall.fontSize,
      color: colors.dark,
    },
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
    undoText: {
      flex: 1,
      minWidth: 0,
      fontSize: typography.bodySmall.fontSize,
      color: colors.slateMedium,
      fontWeight: "500",
    },
    undoAction: {
      fontSize: typography.bodySmall.fontSize,
      fontWeight: "700",
      color: colors.primaryText,
    },
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
    skeletonIcon: {
      width: 44,
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.bgSubtle,
    },
    skeletonTextWrap: { flex: 1, gap: 6 },
    skeletonLineWide: {
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.bgSubtle,
      width: "60%",
    },
    skeletonLineNarrow: {
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.bgSubtle,
      width: "40%",
    },
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
    modalTitle: {
      fontSize: typography.subheading.fontSize,
      fontWeight: "700",
      color: colors.dark,
      letterSpacing: -0.2,
    },
    modalDisclaimer: { marginTop: spacing.lg },
    modalDelete: { marginTop: spacing.md },
  });
