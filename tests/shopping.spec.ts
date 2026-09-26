import { test, expect, type Page } from "@playwright/test";

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
test.beforeAll(async ({ request }) => {
  const response = await request.post("/api/auth/login", { data: { email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD } });
  adminToken = (await response.json()).accessToken;
  const created = await request.post("/api/produtos", { headers: { Authorization: `Bearer ${adminToken}` }, data: {
    name: "Persistencia Browser", price: 31, public: "unissex", category: "camisetas", colors: [{ colorName: "Preto", colorValue: "#111111", images: [], variants: [{ value: "P", stock: 3 }, { value: "M", stock: 2 }] }]
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

test("guest cart merges; favorites and variants persist after logout and in another browser", async ({ page, browser }) => {
  await page.goto("/");
  await card(page).getByRole("button", { name: "P", exact: true }).click();
  await card(page).getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("brecho_guest_cart_v2")!)[0].quantity)).toBe(1);
  await login(page);
  await expect(page.getByRole("status")).toContainText("Carrinho de visitante sincronizado");
  await page.getByRole("button", { name: "Fechar aviso" }).click();
  await card(page).getByRole("button", { name: "Favoritar", exact: true }).click();
  await expect(card(page).getByRole("button", { name: "Remover dos favoritos" })).toHaveAttribute("aria-pressed", "true");
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
  } finally { await other.close(); }
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
  await card(page).getByRole("button", { name: "Favoritar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Favorito indisponivel");
  await expect(card(page).getByRole("button", { name: "Favoritar", exact: true })).toHaveAttribute("aria-pressed", "false");
  await page.route("**/api/carrinho", route => route.request().method() === "PATCH" ? route.fulfill({ status: 409, json: { error: "Estoque insuficiente" } }) : route.continue());
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await page.getByRole("button", { name: "Aumentar quantidade" }).click();
  await expect(page.getByRole("alert")).toContainText("Estoque insuficiente");
  await expect(page.locator("span.w-6")).toHaveText("1");
});
