import { expect, type Page } from "@playwright/test";

export const successToasts = (page: Page) => page.locator('[data-sonner-toast][data-type="success"]');

export async function expectSuccess(page: Page, message: string, tone: "positive" | "change" | "removal" = "positive") {
  await expect(successToasts(page)).toHaveCount(1);
  await expect(successToasts(page).locator('[data-title]')).toHaveText(message);
  await expect(successToasts(page)).toHaveClass(new RegExp(`toast-${tone}`));
  await expect(successToasts(page)).toHaveCSS("background-color", { positive: "rgb(237, 248, 240)", change: "rgb(255, 248, 229)", removal: "rgb(255, 240, 239)" }[tone]);
  await page.getByRole("button", { name: "Fechar notificação", exact: true }).click();
  await expect(successToasts(page)).toHaveCount(0);
}
