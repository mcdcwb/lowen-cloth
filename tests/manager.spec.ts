import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function login(page: Page, role: "ADMIN" | "USER" = "ADMIN") {
  await page.goto("/manager");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.getByLabel("E-mail", { exact: true }).fill(process.env[role === "ADMIN" ? "E2E_ADMIN_EMAIL" : "E2E_USER_EMAIL"]!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env[role === "ADMIN" ? "E2E_ADMIN_PASSWORD" : "E2E_USER_PASSWORD"]!);
  await page.locator('form button[type="submit"]').click();
  if (role === "ADMIN") await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  else await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
}
async function token(page: Page) {
  return page.evaluate(() => JSON.parse(sessionStorage.getItem("lowen-cloth_auth_v1")!).accessToken as string);
}

test("anonymous and USER accounts cannot access administrative routes or mutate products", async ({ page }) => {
  await page.goto("/manager/produtos/novo");
  await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Salvar produto" })).toHaveCount(0);
  await login(page, "USER");
  const accessToken = await token(page);
  for (const path of ["/manager", "/manager/produtos", "/manager/produtos/novo", "/manager/produtos/1/editar"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Acesso restrito" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toHaveCount(0);
  }
  const response = await page.request.post("/api/produtos", { headers: { Authorization: `Bearer ${accessToken}` }, data: {} });
  expect(response.status()).toBe(403);
});

test("ADMIN login redirects to manager, dashboard uses real totals and mobile navigation fits", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await page.getByLabel("E-mail", { exact: true }).fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel("Senha", { exact: true }).fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/manager$/);
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  const products = await (await page.request.get("/api/produtos")).json();
  const total = (p: { variants: { stock: number }[] }) => p.variants.reduce((sum, v) => sum + v.stock, 0);
  const checks = [
    ["Total de produtos", products.length],
    ["Total de variantes", products.reduce((sum: number, p: { variants: unknown[] }) => sum + p.variants.length, 0)],
    ["Produtos sem estoque", products.filter((p: { variants: { stock: number }[] }) => total(p) === 0).length],
    ["Produtos com estoque baixo", products.filter((p: { variants: { stock: number }[] }) => total(p) > 0 && total(p) <= 5).length]
  ];
  for (const [label, count] of checks) await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: String(label), exact: true }) }).locator("p")).toHaveText(String(count));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  for (const width of [320, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: testInfo.outputPath("manager-desktop.png"), fullPage: true });
  await page.getByRole("link", { name: "Ver loja", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("real manager CRUD validates variants, saves stock, filters, edits and deletes with confirmation", async ({ page }) => {
  await login(page);
  const headers = { Authorization: `Bearer ${await token(page)}` };
  const name = "Manager teste " + randomUUID();
  let id: number | undefined;
  try {
    await page.getByRole("link", { name: "Produtos", exact: true }).click();
    await page.getByRole("link", { name: "Novo produto" }).click();
    await page.getByLabel("Nome", { exact: true }).fill(name);
    await page.getByLabel("Descrição", { exact: true }).fill("Produto temporário do teste de integração.");
    await page.getByLabel("Preço (R$)", { exact: true }).fill("149.90");
    await page.getByLabel("Público", { exact: true }).selectOption("feminino");
    await page.getByLabel("Categoria", { exact: true }).selectOption("calcados");
    await page.getByLabel("Nome da cor", { exact: true }).fill("Preto");
    await page.getByLabel("Valor da cor", { exact: true }).fill("#111111");
    await page.getByLabel("Badge (opcional)", { exact: true }).fill("Novo");
    await page.getByLabel("Imagem principal", { exact: true }).fill("https://placehold.co/400x500");
    await page.getByLabel("Imagens adicionais", { exact: true }).fill("https://placehold.co/400x600");
    await page.getByLabel("Variante 1", { exact: true }).fill("38");
    await page.getByLabel("Estoque 1", { exact: true }).fill("-1");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByRole("alert")).toContainText("estoque deve ser inteiro");
    await page.getByLabel("Estoque 1", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Adicionar variante" }).click();
    await page.getByLabel("Variante 2", { exact: true }).fill("38");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByRole("alert")).toContainText("duplicada");
    await page.getByLabel("Variante 2", { exact: true }).fill("Sob medida");
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    let posts = 0;
    await page.route("**/api/produtos", async route => {
      if (route.request().method() === "POST") { posts++; await gate; }
      await route.continue();
    });
    const created = page.waitForResponse(response => response.url().endsWith("/api/produtos") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByRole("button", { name: "Salvando..." })).toBeDisabled();
    await expect(page.getByLabel("Nome", { exact: true })).toBeDisabled();
    await expect.poll(() => posts).toBe(1);
    release();
    const response = await created;
    expect(response.status()).toBe(201);
    id = (await response.json()).id;
    await expect(page.getByRole("status")).toHaveText("Produto criado com sucesso.");
    await page.getByLabel("Buscar por nome").fill(name);
    await page.getByLabel("Categoria", { exact: true }).selectOption("calcados");
    await page.getByLabel("Público", { exact: true }).selectOption("feminino");
    const row = page.getByRole("article", { name, exact: true });
    await expect(row).toContainText("Estoque baixo");
    await expect(row).toContainText("Sob medida: 0");
    await row.getByRole("link", { name: "Editar" }).click();
    await expect(page.getByLabel("Nome", { exact: true })).toHaveValue(name);
    await page.getByLabel("Estoque 1", { exact: true }).fill("9");
    await page.getByRole("button", { name: "Remover variante 2" }).click();
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByRole("status")).toHaveText("Produto atualizado com sucesso.");
    const saved = (await (await page.request.get("/api/produtos")).json()).find((p: { id: number }) => p.id === id);
    expect(saved.variants.map((v: { value: string; stock: number }) => ({ value: v.value, stock: v.stock }))).toEqual([{ value: "38", stock: 9 }]);
    expect(Number(saved.price)).toBe(149.9);
    await page.getByRole("link", { name: "Ver loja", exact: true }).click();
    await expect(page.locator("main").getByText(name, { exact: true })).toBeVisible();
    await page.goBack();
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Remover variante 1" }).click();
    await page.getByRole("button", { name: "Salvar produto" }).click();
    await expect(page.getByRole("status")).toHaveText("Produto atualizado com sucesso.");
    await expect(row).toContainText("Sem estoque");
    await row.getByRole("button", { name: "Excluir", exact: true }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText(name);
    await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Excluir", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
    await expect(page.getByRole("status")).toHaveText("Produto excluído com sucesso.");
    await expect(row).toHaveCount(0);
    expect((await (await page.request.get("/api/produtos")).json()).some((p: { id: number }) => p.id === id)).toBe(false);
  } finally {
    if (id !== undefined) await page.request.delete(`/api/produtos/${id}`, { headers });
  }
});

for (const status of [401, 403]) test(`administrative ${status} response removes access and token`, async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Produtos", exact: true }).click();
  await page.getByRole("link", { name: "Novo produto" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Não persistir");
  await page.getByLabel("Preço (R$)", { exact: true }).fill("10");
  await page.getByLabel("Variante 1", { exact: true }).fill("P");
  await page.route("**/api/produtos", route => route.request().method() === "POST" ? route.fulfill({ status, json: {} }) : route.continue());
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByRole("heading", { name: "Acesso administrativo" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(status === 401 ? "sessão expirou" : "não autorizado");
  expect(await page.evaluate(() => sessionStorage.getItem("lowen-cloth_auth_v1"))).toBeNull();
});

test("manager remains hidden while /auth/me is validating the restored session", async ({ page }) => {
  await login(page);
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/auth/me", async route => { await gate; await route.continue(); });
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Validando sessão...");
  await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toHaveCount(0);
  release();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
});

test("save failure preserves the draft, allows retry and the form fits small screens", async ({ page }) => {
  await login(page);
  await page.getByRole("link", { name: "Produtos", exact: true }).click();
  await page.getByRole("link", { name: "Novo produto" }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Rascunho preservado");
  await page.getByLabel("Preço (R$)", { exact: true }).fill("25");
  await page.getByLabel("Variante 1", { exact: true }).fill("Livre");
  await page.route("**/api/produtos", route => route.request().method() === "POST" ? route.fulfill({ status: 500, json: { error: "Falha temporária." } }) : route.continue());
  await page.getByRole("button", { name: "Salvar produto" }).click();
  await expect(page.getByRole("alert")).toContainText("Falha temporária");
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Rascunho preservado");
  await expect(page.getByRole("button", { name: "Salvar produto" })).toBeEnabled();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("product filters align labels and controls on desktop and stack evenly on mobile", async ({ page }, testInfo) => {
  await login(page);
  await page.getByRole("link", { name: "Produtos", exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const controls = [page.getByLabel("Buscar por nome"), page.getByLabel("Categoria", { exact: true }), page.getByLabel("Público", { exact: true })];
    const boxes = await Promise.all(controls.map(control => control.boundingBox()));
    const labels = await Promise.all(controls.map(control => control.locator("..").locator("span").first().boundingBox()));
    expect(boxes.every(box => box?.height === boxes[0]?.height)).toBe(true);
    if (width === 1440) {
      expect(boxes.every(box => box?.y === boxes[0]?.y)).toBe(true);
      expect(labels.every(box => box?.y === labels[0]?.y)).toBe(true);
    } else {
      expect(boxes.every(box => box?.width === boxes[0]?.width)).toBe(true);
      expect(boxes[1]!.y).toBeGreaterThan(boxes[0]!.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`filters-${width}.png`), fullPage: false });
  }
  await page.getByRole("link", { name: "Ver loja", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/manager");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await page.goto("/manager");
  await page.getByRole("link", { name: "Voltar para a loja" }).click();
  await expect(page).toHaveURL(/\/$/);
});
