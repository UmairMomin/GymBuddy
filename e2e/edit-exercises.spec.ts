import { expect, test } from "@playwright/test";
import { loadStarterPlan, logSet, newPlayer, startPush } from "./helpers/app";

test("edit a live workout: swap with logged sets, remove, space fills the placeholder", async ({ browser }) => {
  const { page } = await newPlayer(browser, "edit");
  await loadStarterPlan(page);
  await startPush(page);

  await logSet(page, "Your", 1, "60", "8");

  // Swap the bench (has a logged set): the picker hides exercises already in the workout, and a confirm guards the delete
  await page.getByRole("button", { name: /^Options for Barbell Bench Press/ }).click();
  await page.getByRole("button", { name: "Swap exercise" }).click();
  await expect(page.getByRole("button", { name: /Incline Dumbbell Press/ })).toHaveCount(0);
  await page.getByLabel("Search exercises").fill("flat");
  await page.getByRole("button", { name: /Dumbbell/ }).first().click();
  await page.getByRole("button", { name: "Swap and delete sets" }).click();
  await expect(page.getByRole("region", { name: /barbell bench press/i })).toHaveCount(0);
  await expect(page.getByLabel(/^Your set 1 weight/)).toHaveValue("");

  // Remove an exercise with no logged sets: no confirm
  await page.getByRole("button", { name: /^Incline Dumbbell Press/ }).click();
  await page.getByRole("button", { name: /^Options for Incline Dumbbell Press/ }).click();
  await page.getByRole("button", { name: "Remove exercise" }).click();
  await expect(page.getByRole("region", { name: /incline dumbbell press/i })).toHaveCount(0);

  // Both changes are persisted
  await page.reload();
  await expect(page.getByRole("region", { name: /barbell bench press/i })).toHaveCount(0);
  await expect(page.getByRole("region", { name: /incline dumbbell press/i })).toHaveCount(0);
});
