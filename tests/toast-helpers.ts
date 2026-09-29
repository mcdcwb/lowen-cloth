import { expect, type Page } from "@playwright/test";

export const successToasts = (page: Page) => page.locator('[data-sonner-toast][data-type="success"]');

export async function expectSuccess(page: Page, message: string) {
  await expect(successToasts(page)).toHaveCount(1);
  await expect(successToasts(page).locator('[data-title]')).toHaveText(message);
  await page.getByRole("button", { name: "Fechar notificação", exact: true }).click();
  await expect(successToasts(page)).toHaveCount(0);
}
