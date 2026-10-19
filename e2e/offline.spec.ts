import { expect, test } from "@playwright/test";
import { loadStarterPlan, logSet, newPlayer, startPush } from "./helpers/app";

test("offline: a set logged without a connection is kept and syncs when back online", async ({ browser }) => {
  const { page, context } = await newPlayer(browser, "offl");
  await loadStarterPlan(page);
  await startPush(page);
  await expect(page.getByRole("region", { name: /barbell bench press/i })).toBeVisible();

  // Lose the connection, log a set: the tap still works and the set is held on the device
  await context.setOffline(true);
  await logSet(page, "Your", 1, "70", "5");
  await expect(page.getByText(/will sync when you/i)).toBeVisible();
  await expect(page.getByText(/1 set is waiting to sync/i)).toBeVisible();

  // Back online: it replays and the banner clears
  await context.setOffline(false);
  await expect(page.getByText(/waiting to sync/i)).toHaveCount(0, { timeout: 40_000 });
  await expect(page.getByText(/will sync when you/i)).toHaveCount(0);

  // It really reached the server
  await page.reload();
  await expect(page.getByLabel(/^Your set 1 weight/)).toHaveValue("70");
  await expect(page.getByLabel(/^Your set 1 reps/)).toHaveValue("5");

  await context.close();
});
