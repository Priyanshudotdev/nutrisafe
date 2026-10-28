import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  defaultMealForNow,
  formatDateLabel,
  formatLongDate,
  groupItemsByMeal,
  isTodayDate,
  shiftDateKey,
  summarizeFoodItems,
  todayDateKey,
  type ConsumptionStatus,
  type FoodLogDay,
  type FoodLogDayMarker,
  type FoodLogItem,
  type MealSlot,
} from "../../data/foodLog";
import { fetchFoodLogDay, updateFoodLogItem } from "../../services/foodLogService";
import { notificationStore } from "../../services/notificationStore";
import { useThemeColors } from "../../hooks/useThemeColors";
import { radius, spacing, typography, type ThemeColors } from "../../theme/tokens";
import { AppButton } from "../../components/AppButton";
import { EmptyState } from "../../components/EmptyState";
import { ErrorBanner } from "../../components/ErrorBanner";
import { FoodLogEditorSheet, type FoodLogEditorEvent } from "../../components/FoodLogEditorSheet";
import { FoodLogRow } from "../../components/FoodLogRow";
import { MedicalDisclaimer } from "../../components/MedicalDisclaimer";
import { NutritionSummaryCard } from "../../components/NutritionSummaryCard";
import { ScreenHeader } from "../../components/ScreenHeader";
import { SegmentControl } from "../../components/SegmentControl";

const EMPTY_ITEMS: FoodLogItem[] = [];
const EMPTY_DAYS: FoodLogDayMarker[] = [];

export default function FoodLogScreen() {
  const { colors, isDark } = useThemeColors();
  const styles = makeStyles(colors);

  const [selectedDate, setSelectedDate] = useState(() => todayDateKey());
  const [day, setDay] = useState<FoodLogDay | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Tagged with the date it belongs to so a stale failure never appears on
  // another day's screen.
  const [errorState, setErrorState] = useState<{ date: string; message: string } | null>(null);
  const [activeList, setActiveList] = useState<ConsumptionStatus>("eaten");
  const [editorVisible, setEditorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<FoodLogItem | null>(null);
  const [editorMeal, setEditorMeal] = useState<MealSlot>(() => defaultMealForNow());
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  // Only touches state after the network call settles, so the effect below
  // never triggers a synchronous cascading render.
  const loadDay = useCallback(async (date: string) => {
    const requestId = ++requestIdRef.current;

    try {
      const data = await fetchFoodLogDay(date);
      if (requestId !== requestIdRef.current) return;
      setDay(data);
      setErrorState(null);
    } catch (e) {
      if (requestId !== requestIdRef.current) return;
      setErrorState({
        date,
        message:
          e instanceof Error
            ? e.message
            : "Couldn't load your food log. Check your connection and try again.",
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Deferred past a microtask so the effect body itself stays free of
    // synchronous state updates (react-hooks/set-state-in-effect).
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadDay(selectedDate);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedDate, loadDay]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void loadDay(selectedDate).finally(() => setIsRefreshing(false));
  }, [loadDay, selectedDate]);

  // Derived rather than stored: while a new date is loading, `day` still holds
  // the previous day, and we must not render it as if it were the new date.
  const currentDay = day && day.date === selectedDate ? day : null;
  const error = errorState && errorState.date === selectedDate ? errorState.message : null;
  const items = currentDay?.items ?? EMPTY_ITEMS;
  const recentDays = day?.days ?? EMPTY_DAYS;
  const summary = useMemo(
    () => currentDay?.summary ?? summarizeFoodItems(EMPTY_ITEMS),
    [currentDay]
  );
  const eatenItems = useMemo(() => items.filter((item) => item.status === "eaten"), [items]);
  const notEatenItems = useMemo(() => items.filter((item) => item.status === "not_eaten"), [items]);
  const activeItems = activeList === "eaten" ? eatenItems : notEatenItems;
  const groups = useMemo(() => groupItemsByMeal(activeItems), [activeItems]);

  const selectedIsToday = isTodayDate(selectedDate);
  const nextDisabled = selectedDate >= todayDateKey();

  const openAdd = () => {
    setEditingItem(null);
    setEditorMeal(defaultMealForNow());
    setEditorVisible(true);
  };

  const openEdit = (item: FoodLogItem) => {
    setEditingItem(item);
    setEditorMeal(item.meal);
    setEditorVisible(true);
  };

  const handleSaved = useCallback((updatedDay: FoodLogDay, event: FoodLogEditorEvent) => {
    setDay(updatedDay);
    setErrorState(null);

    if (event.mode === "create") {
      void notificationStore.push(
        "Food added to your log",
        event.status === "eaten"
          ? `${event.foodName} is counted in ${formatDateLabel(updatedDay.date)} totals.`
          : `${event.foodName} was saved under Not eaten.`
      );
    } else if (event.mode === "delete") {
      void notificationStore.push("Food removed", `${event.foodName} was removed from your log.`);
    }
  }, []);

  const handleToggle = useCallback(
    async (item: FoodLogItem) => {
      if (!currentDay || mutatingId) return;
      const nextStatus: ConsumptionStatus = item.status === "eaten" ? "not_eaten" : "eaten";
      const snapshot = currentDay;
      const optimisticItems = currentDay.items.map((entry) =>
        entry.id === item.id ? { ...entry, status: nextStatus } : entry
      );

      // Optimistic: move the row between lists and recalculate immediately.
      setDay({
        ...currentDay,
        items: optimisticItems,
        summary: summarizeFoodItems(optimisticItems),
      });
      setMutatingId(item.id);
      setErrorState(null);

      try {
        const result = await updateFoodLogItem(item.id, { status: nextStatus });
        setDay(result.day);
      } catch (e) {
        setDay(snapshot);
        setErrorState({
          date: currentDay.date,
          message:
            e instanceof Error
              ? e.message
              : "Couldn't update this food. Check your connection and try again.",
        });
      } finally {
        setMutatingId(null);
      }
    },
    [currentDay, mutatingId]
  );

  const renderEmptyState = () => {
    if (items.length === 0) {
      return (
        <EmptyState
          icon="restaurant-outline"
          title="Nothing logged for this day"
          subtitle="Add the food you ate or plan to eat. Only items marked Eaten count toward nutrition."
          actionLabel="Add food"
          onAction={openAdd}
        />
      );
    }

    if (activeList === "eaten") {
      return (
        <EmptyState
          icon="checkmark-circle-outline"
          title="No food marked eaten yet"
          subtitle="Mark what you actually ate to include it in this day's totals."
          actionLabel="View not eaten"
          onAction={() => setActiveList("not_eaten")}
        />
      );
    }

    return (
      <EmptyState
        icon="restaurant-outline"
        title="Everything logged has been eaten"
        subtitle="Add planned food to keep a Not eaten list for this day."
        actionLabel="Add food"
        onAction={openAdd}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <ScreenHeader
        title="Food Log"
        subtitle="Track what you actually ate."
        right={
          <AppButton
            label="Add food"
            size="sm"
            icon="add"
            onPress={openAdd}
            accessibilityLabel="Add food to log"
          />
        }
      />

      <View style={styles.dateNav}>
        <Pressable
          style={styles.navButton}
          onPress={() => setSelectedDate(shiftDateKey(selectedDate, -1))}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
        >
          <Ionicons name="chevron-back" size={20} color={colors.slateMedium} />
        </Pressable>

        <Pressable
          style={styles.dateCenter}
          onPress={() => setSelectedDate(todayDateKey())}
          disabled={selectedIsToday}
          accessibilityRole="button"
          accessibilityLabel={selectedIsToday ? formatLongDate(selectedDate) : "Return to today"}
        >
          <Text style={styles.dateTitle}>{formatDateLabel(selectedDate)}</Text>
          <Text style={styles.dateSubtitle}>
            {selectedIsToday ? formatLongDate(selectedDate) : "Tap to return to today"}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.navButton, nextDisabled && styles.navDisabled]}
          onPress={() => setSelectedDate(shiftDateKey(selectedDate, 1))}
          disabled={nextDisabled}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          accessibilityState={{ disabled: nextDisabled }}
        >
          <Ionicons name="chevron-forward" size={20} color={colors.slateMedium} />
        </Pressable>
      </View>

      {recentDays.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.recentScroll}
          contentContainerStyle={styles.recentDays}
        >
          {recentDays.map((marker) => {
            const selected = marker.date === selectedDate;
            return (
              <Pressable
                key={marker.date}
                onPress={() => setSelectedDate(marker.date)}
                style={[styles.dayChip, selected && styles.dayChipSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Open ${formatLongDate(marker.date)}, ${Math.round(
                  marker.calories
                )} kcal from ${marker.eatenCount} eaten item${marker.eatenCount === 1 ? "" : "s"}`}
              >
                <Text style={[styles.dayChipLabel, selected && styles.dayChipLabelSelected]}>
                  {formatDateLabel(marker.date)}
                </Text>
                <Text style={[styles.dayChipMeta, selected && styles.dayChipMetaSelected]}>
                  {Math.round(marker.calories)} kcal
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primaryText}
            colors={[colors.primaryText]}
          />
        }
      >
        {error ? (
          <View style={styles.errorWrap}>
            <ErrorBanner
              message={error}
              onRetry={() => {
                void loadDay(selectedDate);
              }}
            />
          </View>
        ) : null}

        {currentDay ? (
          <>
            <NutritionSummaryCard summary={summary} dateLabel={formatLongDate(selectedDate)} />

            <View style={styles.segmentWrap}>
              <SegmentControl<ConsumptionStatus>
                segments={[
                  { id: "eaten", label: `Eaten (${summary.eatenCount})` },
                  { id: "not_eaten", label: `Not eaten (${summary.notEatenCount})` },
                ]}
                active={activeList}
                onChange={setActiveList}
              />
            </View>

            {groups.length === 0
              ? renderEmptyState()
              : groups.map((group) => {
                  const groupCalories =
                    activeList === "eaten" ? summarizeFoodItems(group.items).totals.calories : 0;
                  return (
                    <View key={group.meal} style={styles.group}>
                      <View style={styles.groupHeader}>
                        <Text style={styles.groupLabel}>{group.label}</Text>
                        <Text style={styles.groupMeta}>
                          {activeList === "eaten"
                            ? `${Math.round(groupCalories)} kcal`
                            : `${group.items.length} item${group.items.length === 1 ? "" : "s"}`}
                        </Text>
                      </View>
                      {group.items.map((item) => (
                        <FoodLogRow
                          key={item.id}
                          item={item}
                          busy={mutatingId === item.id}
                          disabled={mutatingId !== null && mutatingId !== item.id}
                          onToggleStatus={() => {
                            void handleToggle(item);
                          }}
                          onPress={() => openEdit(item)}
                        />
                      ))}
                    </View>
                  );
                })}

            <View style={styles.disclaimerWrap}>
              <MedicalDisclaimer />
            </View>
          </>
        ) : error ? null : (
          <FoodLogSkeleton />
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <FoodLogEditorSheet
        visible={editorVisible}
        date={selectedDate}
        initial={editingItem}
        defaultMeal={editorMeal}
        onClose={() => setEditorVisible(false)}
        onSaved={handleSaved}
      />
    </SafeAreaView>
  );
}

function FoodLogSkeleton() {
  const { colors } = useThemeColors();
  const styles = makeStyles(colors);
  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading your food log">
      <View style={styles.skeletonCard}>
        <View style={[styles.skeletonLine, styles.skeletonLineNarrow]} />
        <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
        <View style={styles.skeletonMacroRow}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={`macro-${index}`} style={styles.skeletonMacro} />
          ))}
        </View>
        <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
        <View style={[styles.skeletonLine, styles.skeletonLineMedium]} />
      </View>
      {Array.from({ length: 3 }).map((_, index) => (
        <View key={`row-${index}`} style={styles.skeletonRow}>
          <View style={styles.skeletonCircle} />
          <View style={styles.skeletonRowText}>
            <View style={[styles.skeletonLine, styles.skeletonLineWide]} />
            <View style={[styles.skeletonLine, styles.skeletonLineNarrow]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    dateNav: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    navButton: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      backgroundColor: colors.cardBg,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    navDisabled: { opacity: 0.35 },
    dateCenter: { flex: 1, alignItems: "center", gap: 1, minWidth: 0 },
    dateTitle: { ...typography.title, color: colors.dark },
    dateSubtitle: { ...typography.caption, color: colors.slateMuted, textAlign: "center" },
    recentScroll: { flexGrow: 0, marginBottom: spacing.sm },
    recentDays: { paddingHorizontal: spacing.xl, gap: spacing.sm },
    dayChip: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.cardBg,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      minHeight: 44,
      justifyContent: "center",
      gap: 1,
    },
    dayChipSelected: { backgroundColor: colors.primaryMuted, borderColor: colors.primaryLight },
    dayChipLabel: { ...typography.caption, fontWeight: "700", color: colors.slateMedium },
    dayChipLabelSelected: { color: colors.primaryText },
    dayChipMeta: { ...typography.micro, color: colors.slateMuted },
    dayChipMetaSelected: { color: colors.primaryText },
    scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
    errorWrap: { marginBottom: spacing.md },
    segmentWrap: { marginTop: spacing.lg, marginBottom: spacing.md },
    group: { marginBottom: spacing.xs },
    groupHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: spacing.sm,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
    },
    groupLabel: {
      ...typography.caption,
      fontWeight: "700",
      color: colors.slateLight,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    groupMeta: { ...typography.caption, color: colors.slateMuted },
    disclaimerWrap: { marginTop: spacing.lg },
    bottomSpacer: { height: 100 },
    skeletonCard: {
      backgroundColor: colors.cardBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    skeletonLine: {
      height: 12,
      borderRadius: 6,
      backgroundColor: colors.bgSubtle,
    },
    skeletonLineNarrow: { width: "35%" },
    skeletonLineMedium: { width: "80%" },
    skeletonLineWide: { width: "60%" },
    skeletonMacroRow: { flexDirection: "row", gap: spacing.sm },
    skeletonMacro: {
      flex: 1,
      height: 52,
      borderRadius: radius.md,
      backgroundColor: colors.bgSubtle,
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
    skeletonCircle: {
      width: 26,
      height: 26,
      borderRadius: radius.pill,
      backgroundColor: colors.bgSubtle,
    },
    skeletonRowText: { flex: 1, gap: 6 },
  });
