import { test, expect, type Page } from "@playwright/test";
import { expectSuccess, successToasts } from "./toast-helpers";

let product: any;
let adminToken: string;
async function login(page: Page) {
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await page.getByLabel("E-mail", { exact: true }).fill(process.env.E2E_USER_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.E2E_USER_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await expect(page.getByRole("button", { name: "Cliente", exact: true })).toBeVisible();
  await expect(page.getByText("Sincronizando favoritos e carrinho...")).toHaveCount(0);
}
async function logout(page: Page) {
  await page.getByRole("button", { name: "Cliente", exact: true }).hover();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
}
const card = (page: Page) => page.locator("main div.group").filter({ has: page.getByText("Persistencia Browser", { exact: true }) });

for (const authenticated of [false, true]) test(`cart success toasts are singular and passive updates stay silent (${authenticated ? "USER" : "guest"})`, async ({ page, context }) => {
  await page.goto("/");
  if (authenticated) await login(page);
  const other = await context.newPage();
  await other.goto("/");
  await other.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(other.getByText("Carrinho vazio", { exact: true })).toBeVisible();
  for (const size of ["P", "M"]) {
    await card(page).getByRole("button", { name: size, exact: true }).click();
    await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
    await expectSuccess(page, `Persistencia Browser — tamanho ${size} foi adicionado ao carrinho.`);
  }
  await expect(other.getByRole("button", { name: "Remover item" })).toHaveCount(2);
  await expect(successToasts(other)).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.getByRole("button", { name: "Remover item" })).toHaveCount(2);
  await expect(successToasts(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Remover item" }).first().click();
  await expectSuccess(page, "Persistencia Browser — tamanho P foi removido do carrinho.", "removal");
  await page.keyboard.press("Escape");
  await card(page).getByRole("button", { name: "P", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await expectSuccess(page, "Persistencia Browser — tamanho P foi adicionado ao carrinho.");
  if (!authenticated) {
    await login(page);
    await expect(page.getByRole("status")).toContainText("Carrinho de visitante sincronizado");
    await expect(successToasts(page)).toHaveCount(0);
  }
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.getByRole("button", { name: "Remover item" })).toHaveCount(2);
  await page.getByRole("button", { name: "Limpar Carrinho" }).click();
  await expectSuccess(page, "Carrinho esvaziado com sucesso.", "removal");
  await expect(page.getByText("Carrinho vazio", { exact: true })).toBeVisible();
  await expect(other.getByText("Carrinho vazio", { exact: true })).toBeVisible();
  await expect(successToasts(other)).toHaveCount(0);
});

test("cart API failures never announce success", async ({ page }) => {
  await page.goto("/");
  await login(page);
  await card(page).getByRole("button", { name: "P", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await expectSuccess(page, "Persistencia Browser — tamanho P foi adicionado ao carrinho.");
  await page.route(/\/api\/carrinho(?:\/item)?$/, route => route.request().method() === "GET" ? route.continue() : route.fulfill({ status: 503, json: { error: "Carrinho indisponível" } }));
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Carrinho indisponível");
  await expect(successToasts(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  for (const name of ["Remover item", "Limpar Carrinho"]) {
    const failed = page.waitForResponse(r => r.url().includes("/carrinho") && r.status() === 503);
    await page.getByRole("button", { name, exact: true }).click();
    await failed;
    await expect(page.getByRole("alert")).toContainText("Carrinho indisponível");
    await expect(page.getByRole("button", { name: "Remover item" })).toHaveCount(1);
    await expect(successToasts(page)).toHaveCount(0);
  }
});

for (const width of [1440, 390, 320]) test(`visible toast fits viewport at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  await card(page).getByRole("button", { name: "P", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  const checkAppearance = async (tone: "positive" | "change" | "removal", message: string) => {
    await expect(successToasts(page)).toHaveCount(1);
    await expect(page.locator('[data-sonner-toaster]')).toHaveCount(1);
    await expect(successToasts(page)).toHaveCSS("opacity", "1");
    const bounds = await successToasts(page).boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`toast-${tone}-${width}.png`), animations: "disabled" });
    await expectSuccess(page, message, tone);
  };
  await checkAppearance("positive", "Persistencia Browser — tamanho P foi adicionado ao carrinho.");
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expectSuccess(page, "Persistencia Browser — tamanho P: quantidade 2.");
  await page.getByRole("button", { name: "Diminuir quantidade" }).click();
  await checkAppearance("change", "Persistencia Browser — tamanho P: quantidade 1.");
  await page.getByRole("button", { name: "Diminuir quantidade" }).click();
  await checkAppearance("removal", "Persistencia Browser — tamanho P foi removido do carrinho.");
});
for (const authenticated of [false, true]) test(`quantity changes report only confirmed changes (${authenticated ? "USER" : "guest"})`, async ({ page }) => {
  await page.goto("/");
  if (authenticated) await login(page);
  await card(page).getByRole("button", { name: "P", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await expectSuccess(page, "Persistencia Browser — tamanho P foi adicionado ao carrinho.");
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  const increase = page.getByRole("button", { name: "Aumentar quantidade" });
  const decrease = page.getByRole("button", { name: "Diminuir quantidade" });
  if (authenticated) {
    const saved = await page.request.get("/api/carrinho", { headers: { Authorization: `Bearer ${await page.evaluate(() => JSON.parse(localStorage.getItem("lowen-cloth_auth_v1")!).accessToken)}` } });
    const unchanged = await saved.json();
    await page.route("**/api/carrinho", route => route.request().method() === "PATCH" ? route.fulfill({ json: unchanged }) : route.continue());
    await increase.click();
    await expect(increase).toBeEnabled();
    await expect(page.locator("span.w-6")).toHaveText("1");
    await expect(successToasts(page)).toHaveCount(0);
    await page.unroute("**/api/carrinho");
  }
  for (const quantity of [2, 3]) {
    await increase.click();
    await expectSuccess(page, `Persistencia Browser — tamanho P: quantidade ${quantity}.`);
  }
  await expect(increase).toBeDisabled();
  await expect(successToasts(page)).toHaveCount(0);
  for (const quantity of [2, 1]) {
    await decrease.click();
    await expectSuccess(page, `Persistencia Browser — tamanho P: quantidade ${quantity}.`, "change");
  }
  if (authenticated) {
    await page.route("**/api/carrinho", route => route.request().method() === "PATCH" ? route.fulfill({ status: 409, json: { error: "Estoque insuficiente" } }) : route.continue());
    await increase.click();
    await expect(page.getByRole("alert")).toContainText("Estoque insuficiente");
    await expect(successToasts(page)).toHaveCount(0);
    await page.unroute("**/api/carrinho");
  }
  await decrease.click();
  await expectSuccess(page, "Persistencia Browser — tamanho P foi removido do carrinho.", "removal");
  await expect(page.getByText("Carrinho vazio", { exact: true })).toBeVisible();
});

test.beforeAll(async ({ request }) => {
  const response = await request.post("/api/auth/login", { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
  adminToken = (await response.json()).accessToken;
  const created = await request.post("/api/produtos", { headers: { Authorization: `Bearer ${adminToken}` }, data: {
    name: "Persistencia Browser", price: 31, public: "unissex", categoryId: (await (await request.get("/api/categorias", { headers: { Authorization: `Bearer ${adminToken}` } })).json()).find((c: { name: string }) => c.name === "camisetas").id, colors: [{ colorName: "Preto", colorValue: "#111111", images: [], variants: [{ value: "P", stock: 3 }, { value: "M", stock: 2 }] }]
  } });
  expect(created.status()).toBe(201);
  product = await created.json();
});
test.afterAll(async ({ request }) => {
  if (product) await request.delete(`/api/produtos/${product.id}`, { headers: { Authorization: `Bearer ${adminToken}` } });
});
test.beforeEach(async ({ request }) => {
  const response = await request.post("/api/auth/login", { data: { email: process.env.E2E_USER_EMAIL, password: process.env.E2E_USER_PASSWORD } });
  const headers = { Authorization: `Bearer ${(await response.json()).accessToken}` };
  await request.delete("/api/carrinho", { headers });
  await request.delete(`/api/favoritos/${product.id}`, { headers });
});

test("guest cart merges; favorites and variants persist after logout and in another browser", async ({ page, browser }, info) => {
  await page.route("**/api/produtos", async route => {
    const response = await route.fetch();
    const catalog = await response.json();
    await route.fulfill({ response, json: catalog.map((item: { id: number; colors: object[] }) => item.id === product.id ? { ...item, colors: item.colors.map(color => ({ ...color, images: ["/bookmark-light.svg", "/bookmark-dark.svg"] })) } : item) });
  });
  await page.route("**/bookmark-*.svg", route => route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="100%" height="100%" fill="${route.request().url().includes("light") ? "#F7F7F7" : "#111111"}"/></svg>` }));
  await page.goto("/");
  await card(page).getByRole("button", { name: "P", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("brecho_guest_cart_v2")!)[0].quantity)).toBe(1);
  await login(page);
  await expect(page.getByRole("status")).toContainText("Carrinho de visitante sincronizado");
  await page.getByRole("button", { name: "Fechar aviso" }).click();
  const originalShape = await card(page).locator("[data-bookmark-shape]").getAttribute("d");
  await expect(card(page).locator("[data-bookmark-shape]")).toHaveAttribute("fill", "rgba(0, 0, 0, 0.35)");
  await card(page).evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120)); await card(page).getByRole("img").hover();
  await card(page).getByRole("button", { name: "Favoritar", exact: true }).click();
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" })).toHaveAttribute("aria-pressed", "true");
  await expect(card(page).locator("[data-bookmark-shape]")).toHaveAttribute("fill", "#c61010");
  await expect(card(page).locator("[data-bookmark-shape]")).toHaveAttribute("stroke", "#c61010");
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" }).locator("svg path")).toHaveCount(1);
  await expect(card(page).locator("[data-bookmark-shape]")).toHaveAttribute("d", originalShape!);
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" })).toHaveCSS("outline-style", "none");
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" })).toHaveCSS("border-width", "0px");
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(card(page).locator("svg rect")).toHaveCount(0);
  await page.mouse.move(0, 0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    const favorite = card(page).getByRole("button", { name: "Remover dos favoritos" });
    await expect(favorite.locator("svg")).toHaveCSS("width", "40px");
    await expect(favorite.locator("svg")).toHaveCSS("height", "40px");
    await expect(favorite.locator("[data-bookmark-shape]")).toHaveAttribute("fill", "#c61010");
    await expect(favorite.locator("svg")).toHaveCSS("transform", "none");
    expect(await favorite.evaluate(button => {
      const outer = button.closest(".store-product-card")!.getBoundingClientRect();
      const shape = button.querySelector<SVGPathElement>("[data-bookmark-shape]")!;
      const bounds = shape.getBBox(), matrix = shape.getScreenCTM()!;
      const edge = new DOMPoint(bounds.x + bounds.width + 0.48, bounds.y - 0.48).matrixTransform(matrix);
      return Math.abs(edge.y - outer.top) < 0.05 && Math.abs(outer.right - edge.x - 8) < 0.05;
    })).toBe(true);
    for (const background of ["light", "dark"]) {
      await expect(card(page).getByRole("img")).toHaveAttribute("src", `/bookmark-${background}.svg`);
      await expect(favorite.locator("[data-bookmark-shape]")).toHaveAttribute("d", originalShape!);
      await expect(favorite.locator("[data-bookmark-shape]")).toHaveCSS("fill", "rgb(198, 16, 16)");
      await expect(favorite.locator("[data-bookmark-shape]")).toHaveCSS("stroke", "rgb(198, 16, 16)");
      await card(page).evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 100));
      await card(page).screenshot({ path: info.outputPath(`bookmark-filled-${background}-${width}.png`) });
      await card(page).getByRole("img").hover();
      await card(page).getByRole("button", { name: "Próxima imagem", exact: true }).click();
    }
  }
  await card(page).getByRole("button", { name: "M", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.getByRole("button", { name: "Aumentar quantidade" })).toHaveCount(2);
  await page.getByRole("button", { name: "Aumentar quantidade" }).first().click();
  await expect(page.getByText("Sincronizando favoritos e carrinho...")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await logout(page);
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.getByText("Carrinho vazio", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await login(page);
  await page.goto("/favoritos");
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" })).toBeVisible();
  const other = await browser.newContext();
  try {
    const second = await other.newPage();
    await second.goto("http://127.0.0.1:4178/");
    await login(second);
    await expect(card(second).getByRole("button", { name: "Remover dos favoritos" })).toBeVisible();
    await second.getByRole("button", { name: "Abrir carrinho" }).click();
    await expect(second.getByRole("button", { name: "Aumentar quantidade" })).toHaveCount(2);
    const rows = second.locator("div.flex.gap-3.p-3");
    await expect(rows.first().locator("span.w-6")).toHaveText("2");
    await second.getByRole("button", { name: "Diminuir quantidade" }).first().click();
    await expect(rows.first().locator("span.w-6")).toHaveText("1");
    await second.getByRole("button", { name: "Remover item" }).first().click();
    await expect(second.getByRole("button", { name: "Remover item" })).toHaveCount(1);
    await second.getByRole("button", { name: "Limpar Carrinho" }).click();
    await expect(second.getByText("Carrinho vazio", { exact: true })).toBeVisible();
    await second.keyboard.press("Escape");
    await card(second).getByRole("button", { name: "Remover dos favoritos" }).click();
    await expect(card(second).getByRole("button", { name: "Favoritar", exact: true })).toBeVisible();
    await second.reload();
    await expect(card(second).getByRole("button", { name: "Favoritar", exact: true })).toBeVisible();
    await expect(card(second).locator("[data-bookmark-shape]")).toHaveAttribute("fill", "rgba(0, 0, 0, 0.35)");
  } finally { await other.close(); }
});

test("favorite actions report one confirmed toast on both pages and passive synchronization stays silent", async ({ page, context }) => {
  await page.goto("/"); await login(page);
  const other = await context.newPage(); await other.goto("/");
  await expect(other.getByText("Sincronizando favoritos e carrinho...")).toHaveCount(0);
  let release!: () => void;
  const confirmation = new Promise<void>(resolve => { release = resolve; });
  await page.route(`**/api/favoritos/${product.id}`, async route => { await confirmation; await route.continue(); });
  await card(page).evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120)); await card(page).getByRole("img").hover();
  await card(page).getByRole("button", { name: "Favoritar", exact: true }).click();
  await expect(successToasts(page)).toHaveCount(0);
  release();
  await expectSuccess(page, "Produto adicionado aos favoritos!");
  await page.unroute(`**/api/favoritos/${product.id}`);
  await page.mouse.move(0, 0);
  const saved = card(page).getByRole("button", { name: "Remover dos favoritos" });
  await expect(saved).toHaveCSS("opacity", "1");
  await expect(card(other).getByRole("button", { name: "Remover dos favoritos" })).toHaveCSS("opacity", "1");
  await expect(successToasts(other)).toHaveCount(0);
  const touchContext = await context.browser()!.newContext({ storageState: await context.storageState(), hasTouch: true, isMobile: true });
  try {
    const touchPage = await touchContext.newPage(); await touchPage.goto("/");
    for (const width of [320, 390, 768, 1440]) {
      await touchPage.setViewportSize({ width, height: 1000 });
      await expect(card(touchPage).getByRole("button", { name: "Remover dos favoritos" })).toHaveCSS("opacity", "1");
      await expect(touchPage.locator('.store-favorite-bookmark[aria-pressed="false"]').first()).toHaveCSS("opacity", "1");
    }
    await expect(successToasts(touchPage)).toHaveCount(0);
  } finally { await touchContext.close(); }
  await saved.hover();
  await expect(saved.locator("svg")).toHaveCSS("transform", "matrix(1.1, 0, 0, 1.1, 0, 0)");
  await saved.click(); await expectSuccess(page, "Produto removido dos favoritos!", "removal");
  await page.mouse.move(0, 0);
  await expect(card(page).getByRole("button", { name: "Favoritar", exact: true })).toHaveCSS("opacity", "0");
  await expect(card(other).getByRole("button", { name: "Favoritar", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(successToasts(other)).toHaveCount(0);
  await card(page).evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120)); await card(page).getByRole("img").hover(); await card(page).getByRole("button", { name: "Favoritar", exact: true }).click();
  await expectSuccess(page, "Produto adicionado aos favoritos!");
  await page.reload(); await expect(successToasts(page)).toHaveCount(0);
  await page.goto("/favoritos");
  await page.route(`**/api/favoritos/${product.id}`, route => route.fulfill({ status: 503, json: { error: "Remocao indisponivel" } }));
  await card(page).getByRole("button", { name: "Remover dos favoritos" }).click();
  await expect(page.getByRole("alert")).toContainText("Remocao indisponivel");
  await expect(successToasts(page)).toHaveCount(0);
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" })).toHaveAttribute("aria-pressed", "true");
  await page.unroute(`**/api/favoritos/${product.id}`);
  await card(page).getByRole("button", { name: "Remover dos favoritos" }).click();
  await expectSuccess(page, "Produto removido dos favoritos!", "removal");
  await expect(card(page)).toHaveCount(0);
  await page.goto("/"); await card(page).evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120)); await card(page).getByRole("img").hover();
  await card(page).getByRole("button", { name: "Favoritar", exact: true }).click();
  await expectSuccess(page, "Produto adicionado aos favoritos!");
  await other.close();
});

test("API failures preserve confirmed state and failed guest merge can be retried", async ({ page }) => {
  await page.goto("/");
  await card(page).getByRole("button", { name: "P", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await page.route("**/api/carrinho/sincronizar", route => route.fulfill({ status: 503, json: { error: "Sincronizacao indisponivel" } }));
  await login(page);
  await expect(page.getByRole("alert")).toContainText("Sincronizacao indisponivel");
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("brecho_guest_pending_v2:USER:")).reduce((count, key) => count + JSON.parse(localStorage.getItem(key)!).length, 0))).toBe(1);
  await page.unroute("**/api/carrinho/sincronizar");
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Carrinho de visitante sincronizado");
  await page.getByRole("button", { name: "Fechar aviso" }).click();
  await page.route(`**/api/favoritos/${product.id}`, route => route.fulfill({ status: 503, json: { error: "Favorito indisponivel" } }));
  await card(page).evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 120)); await card(page).getByRole("img").hover();
  await card(page).getByRole("button", { name: "Favoritar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Favorito indisponivel");
  await expect(card(page).getByRole("button", { name: "Favoritar", exact: true })).toHaveAttribute("aria-pressed", "false");
  await expect(successToasts(page)).toHaveCount(0);
  await page.route("**/api/carrinho", route => route.request().method() === "PATCH" ? route.fulfill({ status: 409, json: { error: "Estoque insuficiente" } }) : route.continue());
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(page.getByRole("alert")).toContainText("Estoque insuficiente");
  await expect(page.locator("span.w-6")).toHaveText("1");
});


test("favorite cooldown remains shared across catalog and Favorites navigation", async ({ page }) => {
  await page.goto('/'); await login(page);
  await page.clock.pauseAt(new Date());
  await card(page).evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120));
  await card(page).getByRole('img').hover();
  await card(page).getByRole('button', { name: 'Favoritar', exact: true }).click();
  await page.clock.runFor(0);
  await expect(card(page).getByRole('button', { name: 'Remover dos favoritos' })).toBeDisabled();
  await page.getByRole('button', { name: 'Cliente', exact: true }).click();
  await page.getByRole('link', { name: 'Favoritos', exact: true }).click();
  await expect(card(page).getByRole('button', { name: 'Remover dos favoritos' })).toBeDisabled();
  await expect(card(page).getByRole('button', { name: 'Remover dos favoritos' })).toHaveCSS('opacity', '1');
  await page.clock.runFor(1000);
  await card(page).getByRole('button', { name: 'Remover dos favoritos' }).click();
  await page.clock.runFor(0);
  await expect(card(page)).toHaveCount(0);
  await page.evaluate(() => { history.pushState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
  await expect(card(page).getByRole('button', { name: 'Favoritar', exact: true })).toBeDisabled();
  await page.clock.runFor(1000);
  await expect(card(page).getByRole('button', { name: 'Favoritar', exact: true })).toBeEnabled();
});
