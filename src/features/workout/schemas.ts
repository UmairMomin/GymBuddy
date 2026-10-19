import { z } from "zod";

export const SET_TYPES = ["normal", "warmup", "drop", "failure"] as const;

export const saveSetSchema = z.object({
  /** Client-generated so retries are idempotent. */
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  exercise_id: z.string().uuid(),
  /** Whose set this is. Defaults to the caller; must be a session member (enforced by RLS). */
  user_id: z.string().uuid(),
  set_order: z.number().int().min(1).max(100),
  set_type: z.enum(SET_TYPES),
  weight_kg: z.number().min(0, "Weight can't be negative").max(9999.99, "That weight is too large"),
  reps: z.number().int().min(0, "Reps can't be negative").max(1000, "That many reps is too large"),
  completed: z.boolean(),
  /** null = first write of this set; otherwise the revision the client last saw. */
  expected_revision: z.number().int().min(1).nullable(),
});

export type SaveSetInput = z.infer<typeof saveSetSchema>;

export const idSchema = z.string().uuid();
