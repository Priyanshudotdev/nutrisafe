/** Common Indian foods for suggestions — not pre-approved; each still passes condition checks. */
export const INDIAN_FOOD_SUGGESTIONS = [
  "Idli",
  "Dosa",
  "Dal",
  "Roti",
  "Khichdi",
  "Poha",
  "Curd",
  "Paneer",
  "Upma",
  "Rice",
] as const;

export const INDIAN_CITIES = [
  "Mumbai",
  "Delhi",
  "Bangalore",
  "Chennai",
  "Hyderabad",
  "Kolkata",
  "Pune",
  "Ahmedabad",
] as const;

export type IndianCity = (typeof INDIAN_CITIES)[number];

/** Location-aware alternative hints — practical swaps commonly available in India. */
export function getLocationAlternativeNote(city?: string): string | undefined {
  if (!city) return undefined;
  return `Alternatives consider foods commonly available in ${city} and across India.`;
}
