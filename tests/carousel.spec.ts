import { test, expect } from "@playwright/test";
import { expectSuccess, successToasts } from "./toast-helpers";

const fixture = (id: number, inCarousel = true) => ({ id, name: `Carousel ${id}`, price: 30, public: id % 2 ? "masculino" : "feminino", category: "camisetas", inCarousel,
  colors: [{ id, colorName: "Preto", colorValue: "#111111", images: [`/carousel-${id % 2 ? "portrait" : "landscape"}.svg`], variants: [{ id, value: "M", stock: 4 }] }] });

for (const width of [1440, 390, 320]) test(`slider renders exactly 0–5 selections and preserves images at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/carousel-*.svg", route => route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="${route.request().url().includes("portrait") ? 400 : 1600}" height="${route.request().url().includes("portrait") ? 500 : 900}"><rect width="100%" height="100%" fill="#555"/></svg>` }));
  let count = 0;
  await page.route("**/api/produtos", route => route.fulfill({ json: Array.from({ length: 6 }, (_, i) => fixture(i + 1, i < count)).reverse() }));
  for (count = 0; count <= 5; count++) {
    await page.goto("/");
    await expect(page.locator("main div.group").filter({ has: page.getByText("Carousel 6", { exact: true }) })).toBeVisible();
    const slider = page.getByRole("region", { name: "Carrossel de produtos" });
    await expect(slider).toHaveCount(count ? 1 : 0);
    if (count) {
      await expect(slider.locator("article")).toHaveCount(count);
      await expect(slider.getByRole("button", { name: /Ir para o produto/ })).toHaveCount(count);
      await expect(slider.getByRole("heading")).toHaveText("Carousel 1");
      const img = slider.getByRole("img", { name: "Carousel 1", exact: true });
      await expect(img).toHaveCSS("object-fit", "contain");
      await expect(img).toHaveCSS("height", width >= 640 ? "420px" : "288px");
      await expect(slider.locator('img[aria-hidden="true"]').first()).toHaveCSS("filter", /blur/);
      await slider.hover();
      await slider.getByRole("button", { name: `Ir para o produto ${count}`, exact: true }).click();
      await expect(slider.getByRole("heading")).toHaveText(`Carousel ${count}`);
      await expect.poll(async () => Math.round((await slider.locator('article[aria-hidden="false"]').boundingBox())!.x)).toBe(0);
      const currentImage = slider.getByRole("img", { name: `Carousel ${count}`, exact: true });
      await expect(currentImage).toHaveCSS("object-fit", "contain");
      await expect.poll(() => currentImage.evaluate(image => (image as HTMLImageElement).naturalWidth / (image as HTMLImageElement).naturalHeight)).toBe(count % 2 ? 4 / 5 : 16 / 9);
      if (count === 2) await page.screenshot({ path: testInfo.outputPath(`carousel-${width}.png`) });
      await slider.getByRole("button", { name: "Próximo produto", exact: true }).click();
      await expect(slider.getByRole("heading")).toHaveText("Carousel 1");
      await slider.getByRole("button", { name: "Produto anterior", exact: true }).click();
      await expect(slider.getByRole("heading")).toHaveText(`Carousel ${count}`);
      await slider.getByRole("button", { name: "VER MAIS", exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`productId=${count}`));
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("autoplay pauses on hover and shrinking selection clamps the current index", async ({ page }) => {
  await page.route("**/api/settings", route => route.fulfill({ json: { lowStockThreshold: 5 } }));
  const account = { id: 1, name: "Administrador de teste", email: "admin@example.test", role: "ADMIN" };
  await page.route("**/api/auth/me", route => route.fulfill({ json: { account } }));
  await page.route("**/api/auth/login", route => route.fulfill({ json: { account, accessToken: "test-session", tokenType: "Bearer", expiresIn: 3600, expiresAt: Date.now() + 3600000 } }));
  await page.clock.install();
  let count = 5;
  await page.route("**/api/produtos", route => route.fulfill({ json: Array.from({ length: count }, (_, i) => fixture(i + 1)) }));
  await page.goto("/");
  const slider = page.getByRole("region", { name: "Carrossel de produtos" });
  await expect(slider.getByRole("heading")).toHaveText("Carousel 1");
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5000);
  await expect(slider.getByRole("heading")).toHaveText("Carousel 2");
  await slider.hover(); await page.clock.fastForward(10000);
  await expect(slider.getByRole("heading")).toHaveText("Carousel 2");
  await slider.getByRole("button", { name: "Ir para o produto 5", exact: true }).click();
  await expect(slider.getByRole("heading")).toHaveText("Carousel 5");
  // Trigger the existing catalog refresh by a confirmed Manager mutation.
  await page.evaluate(() => { history.pushState({}, "", "/manager"); window.dispatchEvent(new PopStateEvent("popstate")); });
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("link", { name: "Produtos", exact: true }).click();
  await page.route("**/api/produtos/5/carrossel", route => { count = 2; return route.fulfill({ json: fixture(5, false) }); });
  await page.getByRole("article", { name: "Carousel 5", exact: true }).getByRole("button", { name: "Remover do carrossel" }).click();
  await expectSuccess(page, "Produto removido do carrossel!", "removal");
  await page.getByRole("link", { name: "Ver loja", exact: true }).click();
  await expect(slider.locator("article")).toHaveCount(2);
  await expect(slider.getByRole("heading")).toHaveText("Carousel 2");
});

test("carousel notifications distinguish confirmed changes, removals and real errors", async ({ page }) => {
  const product = fixture(1, false);
  await page.route("**/api/produtos", route => route.fulfill({ json: [product] }));
  let fail = false;
  await page.route("**/api/produtos/1/carrossel", route => {
    if (fail) return route.fulfill({ status: 409, json: { error: "Limite de 5 produtos no carrossel." } });
    product.inCarousel = route.request().postDataJSON().inCarousel;
    return route.fulfill({ json: product });
  });
  await page.goto("/manager");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await page.getByRole("link", { name: "Produtos", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar ao carrossel" }).click();
  await expectSuccess(page, "Produto adicionado ao carrossel!", "change");
  await page.getByRole("button", { name: "Remover do carrossel" }).click();
  await expectSuccess(page, "Produto removido do carrossel!", "removal");
  fail = true;
  await page.getByRole("button", { name: "Adicionar ao carrossel" }).click();
  const error = page.locator('[data-sonner-toast][data-type="error"]');
  await expect(error).toHaveCount(1);
  await expect(error).toContainText("Limite de 5 produtos no carrossel.");
  await expect(error).toHaveCSS("background-color", "rgb(255, 240, 239)");
  await expect(successToasts(page)).toHaveCount(0);
});

test("Manager persists carousel selection, combines filters, prioritizes stably and handles limits", async ({ page }) => {
  await page.goto("/manager");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  const token = await page.evaluate(() => JSON.parse(localStorage.getItem("lowen-cloth_auth_v1")!).accessToken);
  const headers = { Authorization: `Bearer ${token}` };
  const catalogResponse = await page.request.get("/api/produtos");
  expect(catalogResponse.ok()).toBe(true);
  const catalog = await catalogResponse.json();
  test.skip(catalog.some((product: { inCarousel: boolean }) => product.inCarousel),
    "Este cenário de limite global exige carrossel inicialmente vazio; a seleção existente é preservada.");
  const ids: number[] = [];
  const prefix = `Carousel E2E ${Date.now()} `;
  try {
    for (let i = 0; i < 6; i++) {
      const data = fixture(i + 1); const { id, inCarousel, ...input } = data;
      const response = await page.request.post("/api/produtos", { headers, data: { ...input, name: prefix + i, colors: input.colors.map(({ id, ...color }) => ({ ...color, variants: [{ value: "M", stock: 4 }] })) } });
      expect(response.status()).toBe(201); ids.push((await response.json()).id);
    }
    await page.getByRole("link", { name: "Produtos", exact: true }).click();
    await page.reload();
    await page.getByLabel("Buscar por nome").fill(prefix);
    const rows = page.getByRole("article");
    const original = await rows.locator("h2").allTextContents();
    const row = (i: number) => page.getByRole("article", { name: prefix + i, exact: true });
    const add = row(3).getByRole("button", { name: "Adicionar ao carrossel" });
    expect((await add.boundingBox())!.y).toBeLessThan((await row(3).getByRole("button", { name: "Excluir", exact: true }).boundingBox())!.y);
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route(`**/api/produtos/${ids[3]}/carrossel`, async route => { await gate; await route.continue(); });
    await add.click();
    await expect(add).toBeDisabled();
    await expect(add).toHaveAttribute("aria-pressed", "false");
    await expect(successToasts(page)).toHaveCount(0);
    release();
    await expectSuccess(page, "Produto adicionado ao carrossel!", "change");
    await expect(row(3).getByRole("button", { name: "Remover do carrossel" })).toHaveAttribute("aria-pressed", "true");
    await expect(rows.locator("h2")).toHaveText([prefix + 3, ...original.filter(name => name !== prefix + 3)]);
    for (const i of [1, 0, 2, 4]) { await row(i).getByRole("button", { name: "Adicionar ao carrossel" }).click(); await expectSuccess(page, "Produto adicionado ao carrossel!", "change"); }
    await expect(rows.locator("h2")).toHaveText([...original.filter(name => name !== prefix + 5), prefix + 5]);
    await expect(row(5).getByRole("button", { name: "Adicionar ao carrossel" })).toBeDisabled();
    await expect(row(5).locator('[title="Limite de 5 produtos no carrossel"]')).toBeVisible();
    expect((await page.request.patch(`/api/produtos/${ids[5]}/carrossel`, { headers, data: { inCarousel: true } })).status()).toBe(409);
    await page.getByLabel("No carrossel", { exact: true }).check(); await expect(rows).toHaveCount(5);
    await page.getByLabel("Público", { exact: true }).selectOption("masculino"); await expect(rows).toHaveCount(3);
    await page.getByLabel("Categoria", { exact: true }).selectOption("camisetas"); await expect(rows).toHaveCount(3);
    await page.getByLabel("Buscar por nome").fill(prefix + 2); await expect(rows).toHaveCount(1);
    await row(2).getByRole("button", { name: "Remover do carrossel" }).click(); await expectSuccess(page, "Produto removido do carrossel!", "removal");
    await expect(rows).toHaveCount(0);
    await page.getByLabel("No carrossel", { exact: true }).uncheck();
    await expect(rows).toHaveCount(1);
    await page.route(`**/api/produtos/${ids[2]}/carrossel`, route => route.fulfill({ status: 409, json: { error: "Limite de 5 produtos no carrossel." } }));
    await row(2).getByRole("button", { name: "Adicionar ao carrossel" }).click();
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).toContainText("Limite de 5 produtos");
    await expect(successToasts(page)).toHaveCount(0);
    await page.unroute(`**/api/produtos/${ids[2]}/carrossel`);
    await page.reload(); await page.getByLabel("Buscar por nome").fill(prefix);
    await expect(page.getByRole("button", { name: "Remover do carrossel" })).toHaveCount(4);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await row(0).getByRole("button", { name: "Excluir", exact: true }).click();
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();
    await expectSuccess(page, "Produto excluído com sucesso!", "removal");
    await page.getByRole("link", { name: "Ver loja", exact: true }).click();
    await expect(page.getByRole("region", { name: "Carrossel de produtos" }).locator("article")).toHaveCount(3);
  } finally {
    for (const id of ids) await page.request.delete(`/api/produtos/${id}`, { headers });
  }
});
