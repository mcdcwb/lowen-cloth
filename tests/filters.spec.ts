import { test, expect } from "@playwright/test";

const product = (id: number, name: string, audience: string, category: string, variants: { value: string; stock: number }[]) => ({
  id, name, public: audience, categoryId: ["camisetas", "jaquetas", "calcas", "bermudas", "calcados", "vestidos"].indexOf(category) + 1, category: { id: ["camisetas", "jaquetas", "calcas", "bermudas", "calcados", "vestidos"].indexOf(category) + 1, name: ({ camisetas: "Camisetas / Camisas", jaquetas: "Jaquetas / Agasalhos", calcas: "Calças", bermudas: "Bermudas / Shorts", calcados: "Calçados", vestidos: "Vestidos" } as Record<string, string>)[category] ?? category }, price: "129.9", description: "Descrição real do catálogo",
  badge: null, colors: [{ id: id * 10, images: [], imageUrl: null, colorName: "Preto", colorValue: "#111111", variants: variants.map((v, i) => ({ ...v, id: id * 100 + i })) }]
});
const products = [
  product(901, "Camiseta API", "masculino", "camisetas", [{ value: "P", stock: 1 }, { value: "M", stock: 0 }]),
  product(902, "Jaqueta API", "unissex", "jaquetas", [{ value: "M", stock: 2 }, { value: "G", stock: 3 }]),
  product(903, "Calçado API", "feminino", "calcados", [{ value: "38", stock: 0 }, { value: "39", stock: 2 }]),
  product(904, "Camiseta Livre", "unissex", "camisetas", [{ value: "Único", stock: 4 }])
];
test.beforeEach(async ({ page }) => {
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: products }));
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
  await page.route("**/api/produtos{,/admin}", async route => {
    await gate;
    await route.fulfill({ status: 503, json: {} });
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Carregando produtos...");
  release();
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar");
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: [] }));
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
  await page.unroute("**/api/produtos{,/admin}");
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
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: [{ ...products[0], imageUrl: "/broken-product.jpg" }] }));
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
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: [{ ...products[0], price: "invalid" }] }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Não foi possível carregar");
  await expect(page.locator("main").getByText("Camiseta API", { exact: true })).toHaveCount(0);
});

test("audience includes unisex only for adults and clearing resets every existing catalog filter", async ({ page }) => {
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({
    json: [...products,
    product(905, "Infantil API", "infantil", "camisetas", [{ value: "8", stock: 1 }])
    ]
  }));
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
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: [product(910, "Tamanhos API", "unissex", "camisetas", [...variants, { value: "36", stock: 0 }])] }));
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
    await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: [product(911, "Grupo único", "unissex", "camisetas", only)] }));
    await page.reload();
    await expect(sizes.locator("button[aria-pressed]")).toHaveText([only[0].value]);
    await expect(sizes.getByRole("separator")).toHaveCount(0);
  }
});

const sortedFixture = [
  { ...product(911, "Zebra", "masculino", "camisetas", [{ value: "M", stock: 3 }]), price: "100" },
  { ...product(912, "álgebra", "feminino", "jaquetas", [{ value: "G", stock: 3 }]), price: "50" },
  { ...product(913, "Algebra", "unissex", "camisetas", [{ value: "M", stock: 3 }]), price: "500" },
  { ...product(914, "Bota", "masculino", "calcados", [{ value: "39", stock: 3 }]), price: "100" },
];

test("catalog sort toggles independently of filters, clear and initial order", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: sortedFixture }));
  await page.goto("/");
  const names = page.locator("main div.group p.line-clamp-2");
  const controls = page.getByRole("group", { name: "Ordenar produtos" });
  const name = controls.getByRole("button", { name: /Ordenar por nome/ });
  const price = controls.getByRole("button", { name: /Ordenar por preço/ });
  await expect(names).toHaveText(["Zebra", "álgebra", "Algebra", "Bota"]);
  await expect(name).toHaveAttribute("aria-pressed", "false");
  await expect(price).toHaveAttribute("aria-pressed", "false");
  await expect(controls.locator("svg.lucide-arrow-up-down")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Limpar filtros", exact: true })).toHaveCount(0);
  await name.focus(); await page.keyboard.press("Enter");
  await expect(name.locator("svg.lucide-arrow-up")).toBeVisible();
  await expect(price.locator("svg.lucide-arrow-up-down")).toBeVisible();
  await expect(names).toHaveText(["álgebra", "Algebra", "Bota", "Zebra"]);
  await expect(name).toHaveAccessibleName("Ordenar por nome, crescente");
  await page.keyboard.press("Space");
  await expect(name.locator("svg.lucide-arrow-down")).toBeVisible();
  await expect(names).toHaveText(["Zebra", "Bota", "álgebra", "Algebra"]);
  await expect(name).toHaveAccessibleName("Ordenar por nome, decrescente");
  await price.click();
  await expect(name.locator("svg.lucide-arrow-up-down")).toBeVisible();
  await expect(price.locator("svg.lucide-arrow-up")).toBeVisible();
  await expect(name).toHaveAttribute("aria-pressed", "false");
  await expect(price).toHaveAccessibleName("Ordenar por preço, crescente");
  await expect(names).toHaveText(["álgebra", "Zebra", "Bota", "Algebra"]);
  await price.click();
  await expect(price.locator("svg.lucide-arrow-down")).toBeVisible();
  await expect(controls.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Limpar filtros", exact: true })).toHaveCount(0);
  await expect(names).toHaveText(["Algebra", "Zebra", "Bota", "álgebra"]);
  const aside = page.locator("aside");
  await aside.getByRole("button", { name: "Masculino", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Masculino", exact: true })).toBeVisible();
  await expect(names).toHaveText(["Algebra", "Zebra", "Bota"]);
  await aside.getByRole("button", { name: "Camisetas / Camisas", exact: true }).click();
  await aside.getByRole("button", { name: "M", exact: true }).click();
  await expect(names).toHaveText(["Algebra", "Zebra"]);
  await aside.getByRole("button", { name: "Feminino", exact: true }).click();
  await expect(names).toHaveText(["Algebra"]);
  await expect(price).toHaveAccessibleName("Ordenar por preço, decrescente");
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(names).toHaveText(["Algebra", "Zebra", "Bota", "álgebra"]);
  await expect(price).toHaveAttribute("aria-pressed", "true");
  await name.click();
  await expect(name.locator("svg.lucide-arrow-up")).toBeVisible();
  await expect(price.locator("svg.lucide-arrow-up-down")).toBeVisible();
  await expect(name).toHaveAccessibleName("Ordenar por nome, crescente");
  await expect(price).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(names).toHaveText(["Zebra", "álgebra", "Algebra", "Bota"]);
  await expect(name).toHaveAttribute("aria-pressed", "false");
});

for (const width of [1440, 390, 320]) test(`sorting header fits and remains stable at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: sortedFixture }));
  await page.goto("/");
  const heading = page.getByRole("heading", { name: "Todas as Peças", exact: true });
  const controls = page.getByRole("group", { name: "Ordenar produtos" });
  await controls.scrollIntoViewIfNeeded();
  const before = await controls.boundingBox();
  const title = await heading.boundingBox();
  expect(before!.x).toBeGreaterThan(title!.x);
  if (width === 1440) expect(Math.abs(before!.y - title!.y)).toBeLessThan(20);
  else expect(before!.y).toBeGreaterThan(title!.y + title!.height);
  const name = controls.getByRole("button", { name: /Ordenar por nome/ });
  await name.hover();
  await name.click();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(name).toHaveCSS("outline-style", "solid");
  expect(await controls.boundingBox()).toEqual(before);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath(`sort-${width}.png`), animations: "disabled" });
  await name.click();
  await expect(name).toHaveAccessibleName("Ordenar por nome, decrescente");
  expect(await controls.boundingBox()).toEqual(before);
});

for (const width of [1440, 390, 320]) test(`clear filters sits beside stable sort controls at ${width}px`, async ({ page }, testInfo) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/");
  const sizes = width === 1440 ? page.locator("aside").locator("section").first() : page.getByRole("group", { name: "Filtrar por tamanho" });
  await sizes.getByRole("button", { name: "P", exact: true }).click();
  const clear = page.getByRole("button", { name: "Limpar filtros", exact: true });
  const controls = page.getByRole("group", { name: "Ordenar produtos" });
  const name = controls.getByRole("button", { name: /Ordenar por nome/ });
  const price = controls.getByRole("button", { name: /Ordenar por preço/ });
  await clear.scrollIntoViewIfNeeded();
  const bounds = await Promise.all([clear, name, price].map(control => control.boundingBox()));
  const section = page.locator("main section").filter({ has: controls });
  const header = section.locator(":scope > div").first();
  const grid = section.locator(":scope > div.grid");
  const layoutBounds = await Promise.all([header, grid].map(item => item.boundingBox()));
  expect(layoutBounds.every(Boolean)).toBe(true);
  for (const box of bounds) {
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
  }
  expect(bounds[0]!.y + bounds[0]!.height <= bounds[1]!.y || bounds[0]!.x + bounds[0]!.width <= bounds[1]!.x).toBe(true);
  if (width === 1440) {
    expect(bounds[0]!.x + bounds[0]!.width).toBeLessThanOrEqual(bounds[1]!.x);
    expect(bounds[0]!.y).toBe(bounds[1]!.y);
  }
  await page.screenshot({ path: testInfo.outputPath(`inactive-${width}.png`), animations: "disabled" });
  for (const [index, control] of [name, name, price, price, name].entries()) {
    await control.click();
    expect(await Promise.all([clear, name, price].map(item => item.boundingBox()))).toEqual(bounds);
    expect(await Promise.all([header, grid].map(item => item.boundingBox()))).toEqual(layoutBounds);
    await expect(controls.locator('[aria-pressed="true"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (index === 3) await page.screenshot({ path: testInfo.outputPath(`active-${width}.png`), animations: "disabled" });
  }
  await clear.click();
  await expect(clear).toHaveCount(0);
  await expect(name).toHaveAccessibleName("Ordenar por nome, crescente");
});

for (const width of [1440, 390]) {
  test(`piece types remain global across size, audience, category and color selections at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const pants = product(920, "Calça multicor", "feminino", "calcas", [{ value: "P", stock: 0 }]);
    pants.colors.push({ ...pants.colors[0], id: 9201, colorName: "Branco", colorValue: "#FFFFFF", variants: [{ id: 9202, value: "GG", stock: 2 }] });
    // Products absent from the public API cannot create filter options. This
    // public is the audience, while isPublished controls publication.
    await page.route("**/api/produtos{,/admin}", route => route.fulfill({
      json: [
        pants, products[0],
        product(921, "Jaqueta esgotada", "unissex", "jaquetas", [{ value: "M", stock: 0 }]),
        product(922, "Calçado sem variantes", "infantil", "calcados", [])
      ]
    }));
    await page.goto("/");
    const mobile = width < 1024;
    const menu = page.getByRole("button", { name: "Abrir menu de navegação" });
    const options = mobile
      ? page.locator("header").getByRole("button", { name: "Camisetas / Camisas", exact: true }).locator("..")
      : page.locator("aside section").nth(2).locator("div").first();
    const labels = ["Todos", "Calças", "Camisetas / Camisas"];
    const checkOptions = async () => {
      if (mobile) await menu.click();
      await expect(options.getByRole("button")).toHaveText(labels);
    };
    await checkOptions();
    if (mobile) await menu.click();
    const pantsCard = page.locator("main div.group").filter({ has: page.getByText("Calça multicor", { exact: true }) });
    await pantsCard.getByRole("button", { name: "Branco", exact: true }).click();
    await checkOptions();
    await options.getByRole("button", { name: "Calças", exact: true }).click();
    await expect(page.getByText("1 peça encontrada", { exact: true })).toBeVisible();
    const sizes = mobile ? page.getByRole("group", { name: "Filtrar por tamanho" }) : page.locator("aside section").first();
    await sizes.getByRole("button", { name: "P", exact: true }).click();
    await expect(page.getByText("Nenhuma peça encontrada", { exact: true })).toBeVisible();
    await checkOptions();
    if (mobile) await menu.click();
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await expect(page.getByText("4 peças encontradas", { exact: true })).toBeVisible();
    await checkOptions();
    await expect(options.getByRole("button", { name: "Todos", exact: true })).toHaveAttribute("aria-pressed", "true");
    const audience = mobile ? page.locator("header") : page.locator("aside section").nth(1);
    await audience.getByRole("button", { name: "Masculino", exact: true }).click();
    await expect(page.getByText("2 peças encontradas", { exact: true })).toBeVisible();
    await checkOptions();
    await audience.getByRole("button", { name: "Infantil", exact: true }).click();
    await sizes.getByRole("button", { name: "GG", exact: true }).click();
    await expect(page.getByText("Nenhuma peça encontrada", { exact: true })).toBeVisible();
    await checkOptions();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    if (mobile) await menu.click();
    await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
    await expect(page.getByText("4 peças encontradas", { exact: true })).toBeVisible();
  });
}

for (const change of ["removed", "sold out"] as const) {
  test(`catalog refresh clears a selected type when its last available product is ${change}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    let catalog = [products[0], products[1]];
    await page.route("**/api/produtos{,/admin}", route => route.fulfill({ json: catalog }));
    // Exercise the existing onChanged -> useProducts retry flow without DB mutations.
    await page.route("**/api/produtos/902", async route => {
      if (route.request().method() === "DELETE") {
        catalog = [products[0]];
        await route.fulfill({ status: 204 });
      } else if (route.request().method() === "PUT") {
        const updated = { ...products[1], colors: products[1].colors.map(c => ({ ...c, variants: c.variants.map(v => ({ ...v, stock: 0 })) })) };
        catalog = [products[0], updated];
        await route.fulfill({ json: updated });
      } else await route.abort();
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
    await page.getByLabel("E-mail", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel("Senha", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.locator('form button[type="submit"]').click();
    await page.getByRole("link", { name: "Ver loja", exact: true }).click();
    const category = page.locator("aside section").nth(2);
    await category.getByRole("button", { name: "Jaquetas / Agasalhos", exact: true }).click();
    await expect(page.getByText("1 peça encontrada", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: process.env.E2E_ADMIN_EMAIL!.split("@")[0], exact: true }).hover();
    await page.getByRole("link", { name: "Painel Administrativo", exact: true }).click();
    await page.getByRole("link", { name: "Produtos", exact: true }).click();
    const row = page.getByRole("article", { name: "Jaqueta API", exact: true });
    if (change === "removed") {
      await row.getByRole("button", { name: "Excluir", exact: true }).click();
      await page.getByRole("button", { name: "Confirmar exclusão", exact: true }).click();
      await expect(page.getByRole("alertdialog")).toHaveCount(0);
    } else {
      await row.getByRole("link", { name: "Editar", exact: true }).click();
      await page.getByLabel("Estoque 1", { exact: true }).fill("0");
      await page.getByLabel("Estoque 2", { exact: true }).fill("0");
      await page.getByRole("button", { name: "Salvar produto", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Produtos", exact: true })).toBeVisible();
    }
    await page.getByRole("link", { name: "Ver loja", exact: true }).click();
    await expect(category.locator("button[aria-pressed]")).toHaveText(["Todos", "Camisetas / Camisas"]);
    await expect(category.getByRole("button", { name: "Todos", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Limpar filtros", exact: true })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Todas as Peças", exact: true })).toBeVisible();
    await expect(page.locator("main").getByText("Camiseta API", { exact: true })).toBeVisible();
  });
}
