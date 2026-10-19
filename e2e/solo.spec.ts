import { expect, test } from "@playwright/test";
import { loadStarterPlan, logSet, newPlayer, startPush } from "./helpers/app";

test("solo: plan, log a workout with placeholders, finish, history, edit after finish", async ({ browser }) => {
  const { page, context } = await newPlayer(browser, "solo");

  // Plan: the starter week exists and Sunday is rest
  await loadStarterPlan(page);
  await page.getByRole("tab", { name: "Schedule" }).click();
  await expect(page.getByLabel("Routine for Mon")).toHaveValue(/.+/);
  await expect(page.getByLabel("Routine for Sun")).toHaveValue("");

  // Workout: first exercise is the bench press; type set 1, then accept placeholders for set 2
  await startPush(page);
  await expect(page.getByRole("heading", { name: /barbell bench press/i })).toBeVisible();
  await logSet(page, "Your", 1, "60", "8");
  await expect(page.getByRole("timer", { name: /rest timer/i })).toBeVisible();
  await expect(page.getByLabel(/^Your set 2 weight/)).toHaveAttribute("placeholder", "60");
  await page.getByRole("button", { name: /^Log Your set 2$/ }).click();
  await expect(page.getByRole("button", { name: /^Your set 2 logged/ })).toBeVisible();

  // Saved on the server: survives a reload, even one that happens right after the tap (write-ahead outbox)
  await page.reload();
  await expect(page.getByLabel(/^Your set 1 weight/)).toHaveValue("60");
  await expect(page.getByLabel(/^Your set 2 reps/)).toHaveValue("8");

  // Finish
  await page.getByRole("button", { name: "Finish", exact: true }).click();
  await page.getByRole("button", { name: "Finish workout" }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Push").first()).toBeVisible();

  // History: 2 sets x 60 x 8 = 960
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await expect(page.getByText("960", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Barbell Bench Press").first()).toBeVisible();

  // Correct a set after the workout is finished; History recomputes (65x8 + 60x8 = 1000)
  await page.getByRole("link", { name: /view or correct sets/i }).first().click();
  await expect(page.getByText(/^Completed/)).toBeVisible();
  const weight = page.getByLabel(/^Your set 1 weight/);
  await weight.fill("65");
  await weight.blur();
  await expect(page.getByText(/saved on this device/i)).toHaveCount(0);
  await page.waitForTimeout(1500);
  await page.goto("/history");
  await expect(page.getByText("1,000", { exact: true }).first()).toBeVisible();

  await context.close();
});
