/**
 * High-precision weight conversion utilities for GymBuddy.
 * Canonical storage convention: All weights in PostgreSQL are stored in kilograms (kg).
 * Display preferences support 'kg' and 'lb' seamlessly without silent data loss.
 */

export const KG_TO_LB = 2.20462262;

/**
 * Convert kilograms to pounds (rounded to 1 decimal place or integer)
 */
export function kgToLb(kg: number): number {
  if (!kg || kg <= 0) return 0;
  return Math.round(kg * KG_TO_LB * 10) / 10;
}

/**
 * Convert pounds to kilograms (stored with up to 2 decimal places)
 */
export function lbToKg(lb: number): number {
  if (!lb || lb <= 0) return 0;
  return Math.round((lb / KG_TO_LB) * 100) / 100;
}

/**
 * Convert stored canonical kg to the user's preferred unit for input fields
 */
export function toPreferredWeight(kg: number, unit: "kg" | "lb"): number {
  if (unit === "lb") {
    return kgToLb(kg);
  }
  return kg;
}

/**
 * Convert user input in preferred unit back to canonical kg for database persistence
 */
export function toCanonicalKg(value: number, unit: "kg" | "lb"): number {
  if (unit === "lb") {
    return lbToKg(value);
  }
  return value;
}

/**
 * Format a weight value for clean UI display
 */
export function formatWeight(kg: number, unit: "kg" | "lb" = "kg"): string {
  if (unit === "lb") {
    return `${kgToLb(kg).toLocaleString()} lb`;
  }
  return `${kg.toLocaleString()} kg`;
}
