import type {
  CreateFoodLogInput,
  FoodLogDay,
  FoodLogItem,
  UpdateFoodLogInput,
} from "../data/foodLog";
import { apiFetch } from "./apiClient";

export interface FoodLogMutationResult {
  item: FoodLogItem;
  day: FoodLogDay;
}

export interface FoodLogDeleteResult {
  deleted: boolean;
  item: FoodLogItem;
  day: FoodLogDay;
}

/** Fetch one day's log plus authoritative totals from the server. */
export async function fetchFoodLogDay(date: string): Promise<FoodLogDay> {
  return apiFetch<FoodLogDay>(`/food-log?date=${encodeURIComponent(date)}`);
}

/** Add a food item. The server resolves nutrition if it is not supplied. */
export async function addFoodLogItem(input: CreateFoodLogInput): Promise<FoodLogMutationResult> {
  return apiFetch<FoodLogMutationResult>("/food-log", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Update status, quantity or any other field; the day totals are recalculated. */
export async function updateFoodLogItem(
  id: string,
  patch: UpdateFoodLogInput
): Promise<FoodLogMutationResult> {
  return apiFetch<FoodLogMutationResult>(`/food-log/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function deleteFoodLogItem(id: string): Promise<FoodLogDeleteResult> {
  return apiFetch<FoodLogDeleteResult>(`/food-log/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
