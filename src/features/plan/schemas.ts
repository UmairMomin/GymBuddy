import { z } from "zod";

export const EXERCISE_CATEGORIES = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "bicep",
  "tricep",
  "core",
  "cardio",
  "full_body",
  "other",
] as const;

export const EXERCISE_EQUIPMENT = [
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
  "other",
] as const;

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const exerciseInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  category: z.enum(EXERCISE_CATEGORIES),
  primary_equipment: z.enum(EXERCISE_EQUIPMENT).nullable(),
  notes: z.string().trim().max(500).nullable(),
});

export const routineItemSchema = z
  .object({
    exercise_id: z.string().uuid(),
    target_sets: z.number().int().min(1, "At least 1 set").max(20),
    rep_min: z.number().int().min(1).max(100),
    rep_max: z.number().int().min(1).max(100),
  })
  .refine((v) => v.rep_max >= v.rep_min, { message: "Max reps can't be below min reps", path: ["rep_max"] });

export const saveRoutineSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Give the routine a name").max(80),
  description: z.string().trim().max(500).nullable(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
  items: z.array(routineItemSchema).min(1, "Add at least one exercise").max(30),
});

export type ExerciseInput = z.infer<typeof exerciseInputSchema>;
export type RoutineItemInput = z.infer<typeof routineItemSchema>;
export type SaveRoutineInput = z.infer<typeof saveRoutineSchema>;
