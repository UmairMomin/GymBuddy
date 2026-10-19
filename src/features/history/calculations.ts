/**
 * Calculate estimated 1-Rep Max using the Brzycki formula:
 * 1RM = weight * (36 / (37 - reps))
 * Only calculated for reps <= 30
 */
export function calculateEstimated1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  if (reps >= 37) return weightKg * 1.5; // fallback boundary
  return Math.round(weightKg * (36 / (37 - reps)) * 10) / 10;
}

/**
 * Calculate total volume for a list of sets: sum of (weight_kg * reps) for completed sets
 */
export function calculateTotalVolume(
  sets: Array<{ weight_kg: number; reps: number; completed: boolean }>
): number {
  return sets
    .filter((s) => s.completed)
    .reduce((sum, s) => sum + Number(s.weight_kg) * Number(s.reps), 0);
}
