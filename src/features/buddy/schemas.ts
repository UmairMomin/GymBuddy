import { z } from "zod";

export const buddyUsernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Usernames are at least 3 characters")
  .max(30, "Usernames are at most 30 characters")
  .regex(/^[a-z0-9_]+$/, "Usernames use letters, numbers and underscores only");

export const linkIdSchema = z.string().uuid("Invalid request");
