import { test, expect, type Page } from "@playwright/test";
import { expectSuccess } from "./toast-helpers";

const products = [0, 2, 5, 6, 10, 11].map((stock, index) => ({
  id: index + 1, name: `Peça ${stock}`, price: 30, public: "unissex", category: "camisetas", categoryId: 1, inCarousel: index === 3,
  colors: [{ id: index + 1, colorName: "Preto", colorValue: "#111111", images: [], variants: [{ id: index + 1, value: "M", stock }] }]
}));
products.push({ ...products[0], id: 7, name: "Misto", colors: [{ ...products[0].colors[0], id: 7, variants: [{ id: 7, value: "P", stock: 0 }, { id: 8, value: "M", stock: 6 }, { id: 9, value: "G", stock: 11 }] }] });

async function setup(page: Page) {
  let threshold = 5, writes = 0, fail = false;
  const account = { id: 1, name: "Administrador", email: "settings@example.test", role: "ADMIN" };
  await page.route("**/api/auth/me", route => route.fulfill({ json: { account } }));
  await page.route("**/api/auth/login", route => route.fulfill({ json: { account, accessToken: "settings-test", tokenType: "Bearer", expiresIn: 3600, expiresAt: Date.now() + 3600000 } }));
  await page.route("**/api/categorias", route => route.fulfill({ json: [{ id: 1, name: "camisetas" }] }));
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: products }));
  await page.route("**/api/settings", async route => {
    if (fail) return route.fulfill({ status: 500, json: { error: "Falha de configuração" } });
    if (route.request().method() === "PUT") {
      writes++;
      threshold = route.request().postDataJSON().lowStockThreshold;
    }
    return route.fulfill({ json: { lowStockThreshold: threshold } });
  });
  await page.goto("/manager");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(account.email);
  await page.getByLabel("Senha", { exact: true }).fill("test-password");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  return { get writes() { return writes; }, get threshold() { return threshold; }, fail: (value: boolean) => { fail = value; } };
}

for (const width of [1440, 390, 320]) test(`settings persist and update product and variant filters at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 1000 });
  const state = await setup(page);
  const lowVariant = page.getByRole("link", { name: /Variantes com estoque baixo/ });
  await expect(lowVariant.locator("p").first()).toHaveText("2");
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await expect(page).toHaveURL(/\/manager\/settings$/);
  await expect(page.getByRole("link", { name: "Configurações", exact: true })).toHaveAttribute("aria-current", "page");
  const input = page.getByLabel("Limite de estoque baixo");
  const save = page.getByRole("button", { name: "Salvar alterações" });
  await expect(input).toHaveValue("5");
  await expect(save).toBeDisabled();
  for (const invalid of ["", "0", "-1", "1.5", "10000"]) {
    await input.fill(invalid); await save.click();
    await expect(page.getByRole("alert")).toContainText("inteiro entre 1 e 9999");
  }
  expect(state.writes).toBe(0);
  await input.fill("10");
  await expect(page.getByText("Variantes com estoque entre 1 e 10 unidades serão consideradas com estoque baixo.", { exact: false })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath(`settings-${width}.png`), fullPage: true });
  await save.click();
  await expectSuccess(page, "Configurações salvas com sucesso!", "positive");
  expect(state.writes).toBe(1);
  await expect(save).toBeDisabled();
  await page.reload();
  await expect(input).toHaveValue("10");
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(lowVariant.locator("p").first()).toHaveText("5");
  await expect(page.getByRole("region", { name: "Total de variantes" })).not.toContainText("com estoque baixo");
  await page.screenshot({ path: testInfo.outputPath(`settings-dashboard-${width}.png`), fullPage: true });
  await lowVariant.focus(); await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/estoque=variante-baixo$/);
  await expect(page.getByRole("article")).toHaveCount(5);
  await expect(page.getByLabel("Estoque", { exact: true })).toHaveValue("variante-baixo");
  const mixed = page.getByRole("article", { name: "Misto", exact: true });
  await expect(mixed.getByText("Preto / M — 6 unidades (estoque baixo)", { exact: true })).toBeVisible();
  await expect(mixed.getByText("Preto / P — 0 unidades (estoque baixo)", { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(5);
  await page.screenshot({ path: testInfo.outputPath(`settings-list-${width}.png`), fullPage: true });
  await page.getByLabel("Categoria", { exact: true }).selectOption({ label: "camisetas" });
  await page.getByLabel("Público", { exact: true }).selectOption("unissex");
  await page.getByRole("checkbox", { name: /carrossel/i }).check();
  await page.getByRole("searchbox").fill("Peça 6");
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  await input.fill("1"); await save.click();
  await expect(save).toBeDisabled();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(lowVariant.locator("p").first()).toHaveText("0");
  await lowVariant.click();
  await expect(page).toHaveURL(/estoque=variante-baixo$/);
  await expect(page.getByRole("article")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("settings failures preserve draft, prevent repeated submits and allow retry", async ({ page }) => {
  const state = await setup(page);
  await page.getByRole("link", { name: "Configurações", exact: true }).click();
  const input = page.getByLabel("Limite de estoque baixo");
  await input.fill("10");
  state.fail(true);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(1);
  await page.locator('[data-sonner-toast][data-type="error"]').getByRole("button", { name: "Fechar notificação" }).click();
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(0);
  await expect(input).toHaveValue("10");
  expect(state.threshold).toBe(5);
  state.fail(false);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  let calls = 0;
  await page.route("**/api/settings", async route => {
    if (route.request().method() !== "PUT") return route.fallback();
    calls++; await gate; return route.fulfill({ json: { lowStockThreshold: 10 } });
  });
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("button", { name: "Salvando..." })).toBeDisabled();
  await page.locator("main form").evaluate(form => { (form as HTMLFormElement).requestSubmit(); (form as HTMLFormElement).requestSubmit(); });
  expect(calls).toBe(1);
  release();
  await expectSuccess(page, "Configurações salvas com sucesso!", "positive");
  state.fail(true);
  await page.reload();
  await expect(page.getByRole("alert")).toContainText("Falha de configuração");
  await expect(input).toHaveCount(0);
  state.fail(false);
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(input).toHaveValue("5");
});

test("settings page remains restricted to ADMIN", async ({ page }) => {
  await page.goto("/manager/settings");
  await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
  await expect(page.getByLabel("Limite de estoque baixo")).toHaveCount(0);
  const account = { id: 2, name: "Cliente", email: "customer@example.test", role: "USER" };
  await page.route("**/api/auth/me", route => route.fulfill({ json: { account } }));
  await page.route("**/api/auth/login", route => route.fulfill({ json: { account, accessToken: "user-test", tokenType: "Bearer", expiresIn: 3600, expiresAt: Date.now() + 3600000 } }));
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(account.email);
  await page.getByLabel("Senha", { exact: true }).fill("test-password");
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
  await expect(page.getByLabel("Limite de estoque baixo")).toHaveCount(0);
});
