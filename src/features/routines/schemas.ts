import { z } from "zod";

export const exerciseCategorySchema = z.enum([
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "cardio",
  "full_body",
  "other",
]);

export const exerciseEquipmentSchema = z.enum([
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "kettlebell",
  "other",
]);

export const createExerciseSchema = z.object({
  name: z.string().min(2, "Exercise name must be at least 2 characters").max(100),
  category: exerciseCategorySchema,
  primary_equipment: exerciseEquipmentSchema.optional(),
  notes: z.string().max(500).optional(),
  workspace_id: z.string().uuid("A valid workspace is required to create custom exercises"),
});

export const updateExerciseSchema = z.object({
  id: z.string().uuid("Valid exercise ID required"),
  name: z.string().min(2, "Exercise name must be at least 2 characters").max(100),
  category: exerciseCategorySchema,
  primary_equipment: exerciseEquipmentSchema.optional(),
  notes: z.string().max(500).optional(),
});

export const plannedExerciseItemSchema = z.object({
  exercise_id: z.string().uuid(),
  exercise_name: z.string(),
  target_sets: z.number().int().min(1).max(20).default(3),
  target_reps: z.string().default("8-12"), // e.g. "8-12", "5", "AMRAP"
  rest_seconds: z.number().int().min(0).max(600).default(90),
  notes: z.string().optional(),
});

export const createRoutineSchema = z.object({
  name: z.string().min(2, "Routine name must be at least 2 characters").max(100),
  description: z.string().max(500).optional(),
  workspace_id: z.string().uuid("A valid workspace is required"),
  exercises: z.array(plannedExerciseItemSchema).min(1, "At least one exercise is required"),
});

export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type PlannedExerciseItem = z.infer<typeof plannedExerciseItemSchema>;
export type CreateRoutineInput = z.infer<typeof createRoutineSchema>;
