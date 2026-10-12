import { z } from "zod";

export const startSessionSchema = z.object({
  workspace_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  routine_id: z.string().uuid().optional(),
  routine_version_id: z.string().uuid().optional(),
});

export const logSetSchema = z.object({
  session_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  user_id: z.string().uuid(),
  set_order: z.number().int().min(1),
  set_type: z.enum(["warmup", "normal", "drop", "failure"]).default("normal"),
  weight_kg: z.number().min(0).max(1000).default(0),
  reps: z.number().int().min(0).max(500).default(0),
  rpe: z.number().min(1).max(10).optional().nullable(),
  completed: z.boolean().default(false),
  notes: z.string().max(250).optional().nullable(),
});

export const updateSetSchema = z.object({
  id: z.string().uuid(),
  weight_kg: z.number().min(0).max(1000).optional(),
  reps: z.number().int().min(0).max(500).optional(),
  rpe: z.number().min(1).max(10).optional().nullable(),
  set_type: z.enum(["warmup", "normal", "drop", "failure"]).optional(),
  completed: z.boolean().optional(),
  notes: z.string().max(250).optional().nullable(),
  revision_number: z.number().int().min(1), // OCC revision check
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type LogSetInput = z.infer<typeof logSetSchema>;
export type UpdateSetInput = z.infer<typeof updateSetSchema>;
