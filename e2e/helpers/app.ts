import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { E2E_PREFIX } from "./cleanup";

export type TestUser = { username: string; password: string; name: string };

export function newUser(label: string): TestUser {
  const id = randomBytes(4).toString("hex");
  return {
    username: `${E2E_PREFIX}${label}${id}`.slice(0, 30),
    // Random per run, never logged.
    password: randomBytes(12).toString("base64url"),
    name: `E2E ${label}`,
  };
}

/** Sign up through the real UI and land on Today. */
export async function signUp(page: Page, user: TestUser) {
  await page.goto("/login");
  await page.getByRole("button", { name: /need an account\? sign up/i }).click();
  await page.getByLabel(/name/i).first().fill(user.name);
  await page.getByLabel(/username/i).fill(user.username);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: "Sign Up", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 30_000 });
}

export async function newPlayer(browser: Browser, label: string): Promise<{ context: BrowserContext; page: Page; user: TestUser }> {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const user = newUser(label);
  await signUp(page, user);
  return { context, page, user };
}

/** Plan → Routines → load the starter plan (Push/Pull/Legs/Shoulders + Arms). */
export async function loadStarterPlan(page: Page) {
  await page.goto("/plan?tab=routines");
  await page.getByRole("button", { name: /start with push \/ pull/i }).click();
  // Wait for the seeded routines themselves (the button text also mentions "Shoulders + Arms").
  await expect(page.getByRole("button", { name: "Edit Push" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Edit Shoulders + Arms" })).toBeVisible();
}

/** Start the Push routine from Today regardless of the weekday (via the picker). */
export async function startPush(page: Page, withBuddy = false) {
  await page.goto("/");
  if (withBuddy) {
    const toggle = page.getByRole("switch");
    await expect(toggle).toBeVisible();
    if ((await toggle.getAttribute("aria-checked")) !== "true") await toggle.click();
  }
  // Open the routine picker: "Change" on a scheduled day, "Start a workout anyway" on a rest day.
  const change = page.getByRole("button", { name: "Change", exact: true });
  const anyway = page.getByRole("button", { name: /start a workout anyway/i });
  await expect(change.or(anyway)).toBeVisible({ timeout: 20_000 });
  await (await change.isVisible() ? change : anyway).click();
  await page.getByRole("button", { name: /^Push\b/ }).click();
  await expect(page).toHaveURL(/\/session\//, { timeout: 30_000 });
}

/** Type weight and reps into set N for the given lane label ("Your" or the buddy's possessive) and log it. */
export async function logSet(page: Page, who: string, n: number, weight: string, reps: string) {
  await page.getByLabel(new RegExp(`^${who} set ${n} weight`)).fill(weight);
  await page.getByLabel(new RegExp(`^${who} set ${n} reps`)).fill(reps);
  await page.getByRole("button", { name: new RegExp(`^Log ${who} set ${n}$`) }).click();
}
