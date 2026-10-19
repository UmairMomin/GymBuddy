import { expect, test } from "@playwright/test";
import { newUser, signUp } from "./helpers/app";

test("signed-out visitors are sent to sign in, and bad credentials are refused", async ({ page }) => {
  for (const path of ["/", "/plan", "/buddy", "/history", "/settings"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }

  await page.getByLabel(/username/i).fill("zz_e2e_nobody");
  await page.getByLabel(/password/i).fill("definitely-wrong-1");
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByText(/incorrect username or password/i)).toBeVisible();
});

test("sign up, sign out, sign back in", async ({ page }) => {
  const user = newUser("auth");
  await signUp(page, user);

  await page.getByRole("button", { name: /account menu/i }).click();
  await page.getByRole("menuitem", { name: /log out/i }).click();
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel(/username/i).fill(user.username);
  await page.getByLabel(/password/i).fill(user.password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible({ timeout: 30_000 });
});
