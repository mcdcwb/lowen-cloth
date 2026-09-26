import { test, expect } from "@playwright/test";

const product = (id: number, name: string, audience: string, category: string, variants: { value: string; stock: number }[]) => ({
  id, name, public: audience, category, price: "129.9", description: "Descrição real do catálogo",
  badge: null, colors: [{ id: id * 10, images: [], imageUrl: null, colorName: "Preto", colorValue: "#111111", variants: variants.map((v, i) => ({ ...v, id: id * 100 + i })) }]
});
const products = [
  product(901, "Camiseta API", "masculino", "camisetas", [{ value: "P", stock: 1 }, { value: "M", stock: 0 }]),
  product(902, "Jaqueta API", "unissex", "jaquetas", [{ value: "M", stock: 2 }, { value: "G", stock: 3 }]),
  product(903, "Calçado API", "feminino", "calcados", [{ value: "38", stock: 0 }, { value: "39", stock: 2 }]),
  product(904, "Camiseta Livre", "unissex", "camisetas", [{ value: "Único", stock: 4 }])
];
test.beforeEach(async ({ page }) => {
  await page.route("**/api/produtos", route => route.fulfill({ json: products }));
});

test("catalog combines audience, category and in-stock sizes across header and aside", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const aside = page.locator("aside");
  const sections = aside.locator("section");
  const [sizes, audience, category] = [sections.nth(0), sections.nth(1), sections.nth(2)];
  const header = page.locator("header");
  const count = page.getByText(/^[0-9]+ peças? encontrad[ao]s?$/);
  await expect(count).toHaveText("4 peças encontradas");
  await expect(page.getByRole("button", { name: "Limpar filtros", exact: true })).toHaveCount(0);
  await expect(aside.locator("h3")).toHaveText(["Tamanhos", "Público", "Categoria"]);
  await header.getByRole("button", { name: "Público", exact: true }).click();
  await header.getByRole("button", { name: "Masculino", exact: true }).click();
  await expect(audience.getByRole("button", { name: "Masculino" })).toHaveAttribute("aria-pressed", "true");
  await header.getByRole("button", { name: "Categorias", exact: true }).click();
  await header.getByRole("button", { name: "Camisetas / Camisas", exact: true }).click();
  await expect(category.getByRole("button", { name: "Camisetas / Camisas" })).toHaveAttribute("aria-pressed", "true");
  await sizes.getByRole("button", { name: "M", exact: true }).click();
  await expect(count).toHaveText("0 peças encontradas");
  await sizes.getByRole("button", { name: "P", exact: true }).click();
  await expect(count).toHaveText("1 peça encontrada");
  await sizes.locator("h3 button").click();
  await expect(sizes.locator("h3 button")).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(count).toHaveText("4 peças encontradas");
  await expect(page.getByRole("button", { name: "Limpar filtros", exact: true })).toHaveCount(0);
  await sizes.locator("h3 button").click();
  await sizes.getByRole("button", { name: "39", exact: true }).click();
  await expect(count).toHaveText("1 peça encontrada");
  await expect(page.locator("main").getByText("Calçado API", { exact: true })).toBeVisible();
});

test("mobile filters support arbitrary sizes without overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("group", { name: "Filtrar por tamanho" }).getByRole("button", { name: "Único", exact: true }).click();
  await expect(page.getByText("1 peça encontrada", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByText("4 peças encontradas", { exact: true })).toBeVisible();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("catalog shows loading, retry after errors, and a separate empty state", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/produtos", async route => {
    await gate;
    await route.fulfill({ status: 503, json: {} });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Carregando produtos...");
  release();
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar");
  await page.route("**/api/produtos", route => route.fulfill({ json: [] }));
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.getByText("Nenhuma peça encontrada", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("detail and persisted cart respect variant stock and decimal prices", async ({ page }) => {
  await page.goto("/?productId=901");
  await expect(page.getByRole("heading", { name: "Camiseta API", exact: true })).toBeVisible();
  await expect(page.getByText("Descrição real do catálogo")).toBeVisible();
  await expect(page.getByRole("button", { name: "M", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "P", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await expect(page.getByRole("button", { name: "P", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
  await expect(page.getByText(/R\$\s*129,90/).first()).toBeVisible();
  await page.evaluate(() => localStorage.setItem("brecho_guest_cart_v2", JSON.stringify([
    { product: { id: 901, price: 1 }, size: "P", quantity: 99 },
    { product: { id: 901 }, size: "M", quantity: 4 },
    { product: { id: 99999 }, size: "P", quantity: 4 }
  ])));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Camiseta API", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("brecho_guest_cart_v2")!));
  expect(saved).toHaveLength(1);
  expect(saved[0].quantity).toBe(1);
  expect(saved[0].product.price).toBe(129.9);
});

test("catalog loads real PostgreSQL products through the API proxy", async ({ page }) => {
  await page.unroute("**/api/produtos");
  const response = await page.request.get("/api/produtos");
  expect(response.ok()).toBeTruthy();
  const realProducts = await response.json();
  expect(realProducts.length).toBeGreaterThan(0);
  await page.goto("/");
  await expect(page.getByText(`${realProducts.length} peças encontradas`, { exact: true })).toBeVisible();
  await expect(page.locator("main").getByText(realProducts[0].name, { exact: true })).toBeVisible();
});

test("cards cap additions by stock and replace broken images without changing their layout", async ({ page }) => {
  await page.route("**/broken-product.jpg", route => route.fulfill({ status: 404, body: "missing" }));
  await page.route("**/api/produtos", route => route.fulfill({ json: [{ ...products[0], imageUrl: "/broken-product.jpg" }] }));
  await page.goto("/");
  const main = page.locator("main");
  const image = main.getByRole("img", { name: "Camiseta API", exact: true });
  await expect(image).toHaveAttribute("src", /^data:image\/svg\+xml/);
  await expect(image).toHaveClass(/object-cover/);
  await expect(main.getByRole("button", { name: "M", exact: true }).last()).toBeDisabled();
  await main.getByRole("button", { name: "P", exact: true }).last().click();
  await main.getByRole("button", { name: "Adicionar ao carrinho", exact: true }).click();
  await expect(main.getByRole("button", { name: /Adicionado|Limite de estoque/ })).toBeDisabled();
  await page.getByRole("button", { name: "Abrir carrinho" }).click();
  await expect(page.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
});

test("malformed catalog data is an API error instead of a fabricated catalog", async ({ page }) => {
  await page.route("**/api/produtos", route => route.fulfill({ json: [{ ...products[0], price: "invalid" }] }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar");
  await expect(page.locator("main").getByText("Camiseta API", { exact: true })).toHaveCount(0);
});

test("audience includes unisex only for adults and clearing resets every existing catalog filter", async ({ page }) => {
  await page.route("**/api/produtos", route => route.fulfill({ json: [...products,
    product(905, "Infantil API", "infantil", "camisetas", [{ value: "8", stock: 1 }])
  ] }));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const sections = page.locator("aside section");
  const [sizes, audience, category] = [sections.nth(0), sections.nth(1), sections.nth(2)];
  const clear = page.getByRole("button", { name: "Limpar filtros", exact: true });
  const count = page.getByText(/^[0-9]+ peças? encontrad[ao]s?$/);
  await expect(count).toHaveText("5 peças encontradas");
  await expect(clear).toHaveCount(0);
  for (const [label, total] of [["Masculino", 3], ["Feminino", 3], ["Unissex", 2], ["Infantil", 1]] as const) {
    await audience.getByRole("button", { name: label, exact: true }).click();
    await expect(clear).toBeVisible();
    await expect(count).toHaveText(`${total} ${total === 1 ? "peça encontrada" : "peças encontradas"}`);
    await clear.click();
    await expect(clear).toHaveCount(0);
    await expect(count).toHaveText("5 peças encontradas");
  }
  await category.getByRole("button", { name: "Camisetas / Camisas", exact: true }).click();
  await expect(clear).toBeVisible();
  await clear.click();
  await sizes.getByRole("button", { name: "Único", exact: true }).click();
  await expect(clear).toBeVisible();
  await category.getByRole("button", { name: "Camisetas / Camisas", exact: true }).click();
  await audience.getByRole("button", { name: "Feminino", exact: true }).click();
  await expect(count).toHaveText("1 peça encontrada");
  await expect(page.locator("main").getByText("Camiseta Livre", { exact: true })).toBeVisible();
  await clear.click();
  await expect(count).toHaveText("5 peças encontradas");
  await expect(clear).toHaveCount(0);
  await expect(sizes.getByRole("button", { name: "Único", exact: true })).toHaveAttribute("aria-pressed", "false");
  for (const section of [category, audience]) await expect(section.getByRole("button", { name: "Todos", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("size groups use only available variants, with a divider only between text and numbers", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const variants = ["10", "9", "8", "M", "P", "Único"].map(value => ({ value, stock: 2 }));
  await page.route("**/api/produtos", route => route.fulfill({ json: [product(910, "Tamanhos API", "unissex", "camisetas", [...variants, { value: "36", stock: 0 }])] }));
  await page.goto("/");
  const sizes = page.locator("aside section").first();
  await expect(sizes.locator("button[aria-pressed]")).toHaveText(["P", "M", "Único", "8", "9", "10"]);
  await expect(sizes.getByRole("separator")).toHaveCount(1);
  expect(await sizes.locator("hr").evaluate(element => [element.previousElementSibling?.textContent?.trim(), element.nextElementSibling?.textContent?.trim()])).toEqual(["Único", "8"]);
  await sizes.locator("h3 button").click();
  await expect(sizes.getByRole("separator")).toBeHidden();
  await sizes.locator("h3 button").click();
  await expect(sizes.getByRole("separator")).toBeVisible();
  for (const only of [[{ value: "Único", stock: 1 }], [{ value: "8", stock: 1 }]]) {
    await page.route("**/api/produtos", route => route.fulfill({ json: [product(911, "Grupo único", "unissex", "camisetas", only)] }));
    await page.reload();
    await expect(sizes.locator("button[aria-pressed]")).toHaveText([only[0].value]);
    await expect(sizes.getByRole("separator")).toHaveCount(0);
  }
});
