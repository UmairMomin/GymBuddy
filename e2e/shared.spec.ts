import { expect, test } from "@playwright/test";
import { loadStarterPlan, logSet, newPlayer, startPush } from "./helpers/app";

/**
 * Two real accounts, two browser contexts, the real Supabase Realtime channel:
 * buddy link, invite, join, live logging in both directions, mutual editing, shared rest timer,
 * host finish, and editing after the workout is finished.
 */
test("shared workout: link, invite, join, log together, edit each other, finish", async ({ browser }) => {
  const host = await newPlayer(browser, "host");
  const guest = await newPlayer(browser, "guest");
  const A = host.page;
  const B = guest.page;
  const hostName = host.user.name; // "E2E host"
  const guestName = guest.user.name;

  // ---- buddy link --------------------------------------------------------------------------
  await A.goto("/buddy");
  await A.getByLabel("Buddy username").fill(guest.user.username);
  await A.getByRole("button", { name: /send/i }).click();
  await expect(A.getByText(/waiting for them to accept/i)).toBeVisible();

  await B.goto("/buddy");
  await B.getByRole("button", { name: `Accept ${hostName}` }).click();
  await expect(B.getByRole("button", { name: "Remove buddy" })).toBeVisible({ timeout: 30_000 }); // accepted
  await A.reload();
  await expect(A.getByRole("button", { name: "Remove buddy" })).toBeVisible();
  await expect(A.getByText(guestName).first()).toBeVisible();

  // ---- host starts a workout with the buddy; guest gets the invite and confirms ------------------
  await loadStarterPlan(A);
  await B.goto("/buddy"); // guest is sitting somewhere in the app
  await startPush(A, true);
  const sessionUrl = A.url();

  const banner = B.getByRole("alert").filter({ hasText: /started Push/i });
  await expect(banner).toBeVisible({ timeout: 30_000 }); // via Realtime, or the foreground refetch
  await banner.getByRole("button", { name: "Join" }).click();
  await expect(B).toHaveURL(sessionUrl);
  await expect(B.getByRole("heading", { name: /barbell bench press/i })).toBeVisible();
  await expect(A.getByText(new RegExp(`${guestName} (is here|· not connected)`))).toBeVisible({ timeout: 30_000 });

  // ---- live logging, both directions -----------------------------------------------------------
  await logSet(A, "Your", 1, "60", "8");
  await expect(B.getByLabel(new RegExp(`^${hostName}'s set 1 weight`))).toHaveValue("60", { timeout: 30_000 });
  await expect(B.getByLabel(new RegExp(`^${hostName}'s set 1 reps`))).toHaveValue("8");

  await logSet(B, "Your", 1, "40", "10");
  await expect(A.getByLabel(new RegExp(`^${guestName}'s set 1 weight`))).toHaveValue("40", { timeout: 30_000 });

  // The rest timer started by B is shared with A
  await expect(A.getByRole("timer", { name: /rest timer/i })).toBeVisible({ timeout: 30_000 });
  await expect(A.getByText(/rest · shared/i)).toBeVisible();

  // ---- mutual edit: guest corrects the host's weight; host sees it, attributed ------------------
  const hostWeightOnB = B.getByLabel(new RegExp(`^${hostName}'s set 1 weight`));
  await hostWeightOnB.fill("62.5");
  await hostWeightOnB.blur();
  await expect(A.getByLabel(/^Your set 1 weight/)).toHaveValue("62.5", { timeout: 30_000 });
  await expect(A.getByText(new RegExp(`edited by ${guestName}`))).toBeVisible();

  // ---- host finishes for everyone; guest's screen follows ---------------------------------------
  await A.getByRole("button", { name: "Finish", exact: true }).click();
  await A.getByRole("button", { name: "Finish workout" }).click();
  await expect(A.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 30_000 });
  await expect(B.getByText(/^Completed/)).toBeVisible({ timeout: 30_000 });

  // ---- editing after the workout is finished still works, and persists ------------------------------
  const again = B.getByLabel(new RegExp(`^${hostName}'s set 1 weight`));
  await again.fill("65");
  await again.blur();
  await B.waitForTimeout(1500);
  await B.reload();
  await expect(B.getByLabel(new RegExp(`^${hostName}'s set 1 weight`))).toHaveValue("65");

  // ---- the host's History reflects the correction: 65 x 8 = 520 -------------------------------------
  await A.goto("/history");
  await expect(A.getByText("520", { exact: true }).first()).toBeVisible();
  await expect(A.getByText(new RegExp(`with ${guestName}`)).first()).toBeVisible();

  // ---- privacy: the guest's History has only their own set (40 x 10 = 400), never the host's solo data
  await B.goto("/history");
  await expect(B.getByText("400", { exact: true }).first()).toBeVisible();

  await host.context.close();
  await guest.context.close();
});

test("a stranger cannot open someone else's workout", async ({ browser }) => {
  const host = await newPlayer(browser, "own");
  const stranger = await newPlayer(browser, "strg");
  await loadStarterPlan(host.page);
  await startPush(host.page);
  const url = host.page.url();

  await stranger.page.goto(url);
  await expect(stranger.page.getByText(/workout not found/i)).toBeVisible();

  await host.context.close();
  await stranger.context.close();
});
