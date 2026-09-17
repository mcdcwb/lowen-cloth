import { test, expect, type Page } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL!;
const password = process.env.E2E_ADMIN_PASSWORD!;
const userEmail = process.env.E2E_USER_EMAIL!;
const userPassword = process.env.E2E_USER_PASSWORD!;
const registerEmail = process.env.E2E_REGISTER_EMAIL!;
const storageKey = "lowen-cloth_auth_v1";

async function loginCustomer(page: Page) {
  await openLogin(page);
  await page.getByLabel("E-mail", { exact: true }).fill(userEmail);
  await page.getByLabel("Senha", { exact: true }).fill(userPassword);
  await submit(page);
  await expect(page.getByRole("button", { name: "Cliente", exact: true })).toBeVisible();
}

test("customer menu stays open across the gap, navigates, restores session and logs out", async ({ page }) => {
  await loginCustomer(page);
  const trigger = page.getByRole("button", { name: "Cliente", exact: true });
  const menu = page.getByRole("navigation", { name: "Menu da conta" });
  await trigger.hover();
  await expect(menu.locator("a, button")).toHaveText(["Minha Conta", "Favoritos", "Sair"]);
  await trigger.click();
  await expect(menu).toBeVisible();
  const box = (await trigger.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 4);
  await expect(menu).toBeVisible();
  await menu.getByRole("link", { name: "Minha Conta" }).hover();
  await expect(menu).toBeVisible();
  await page.mouse.move(1, 200);
  await expect(menu).toBeHidden();
  await trigger.hover();
  await menu.getByRole("link", { name: "Minha Conta" }).click();
  await expect(page).toHaveURL(/\/minha-conta$/);
  await expect(page.getByRole("heading", { name: "Minha Conta", exact: true })).toBeVisible();
  const me = page.waitForResponse("**/api/auth/me");
  await page.reload();
  expect((await me).status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Minha Conta", exact: true })).toBeVisible();
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.hover();
  await menu.getByRole("link", { name: "Favoritos" }).click();
  await expect(page).toHaveURL(/\/favoritos$/);
  await expect(page.getByRole("heading", { name: "Favoritos", exact: true })).toBeVisible();
  await trigger.hover();
  await menu.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Favoritos", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Área de clientes" })).toBeVisible();
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Favoritos", exact: true })).toHaveCount(0);
});

for (const path of ["/minha-conta", "/favoritos"]) {
  test(`anonymous direct access to ${path} cannot render private content`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Área de clientes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^(Minha Conta|Favoritos)$/ })).toHaveCount(0);
  });
}

test("product detail shares the customer menu and browser back preserves navigation", async ({ page }) => {
  await loginCustomer(page);
  const products = await (await page.request.get("/api/produtos")).json();
  const productId = products[0].id;
  await page.goto(`/?productId=${productId}`);
  const trigger = page.getByRole("button", { name: "Cliente", exact: true });
  await trigger.hover();
  await page.getByRole("navigation", { name: "Menu da conta" }).getByRole("link", { name: "Favoritos" }).click();
  await expect(page.getByRole("heading", { name: "Favoritos", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`productId=${productId}$`));
  await expect(page.getByRole("button", { name: "Voltar para a loja" })).toBeVisible();
  await trigger.hover();
  await expect(page.getByRole("navigation", { name: "Menu da conta" })).toBeVisible();
});

test("customer private page is hidden while validating and after token rejection", async ({ page }) => {
  await loginCustomer(page);
  let rejectSession!: () => void;
  const gate = new Promise<void>(resolve => { rejectSession = resolve; });
  await page.route("**/api/auth/me", async route => {
    await gate;
    await route.fulfill({ status: 401, json: { error: "Token inválido ou expirado." } });
  });
  await page.goto("/minha-conta");
  await expect(page.getByRole("heading", { name: "Minha Conta", exact: true })).toHaveCount(0);
  rejectSession();
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  await expect(page.getByRole("heading", { name: "Área de clientes" })).toBeVisible();
});

test("administrator keeps existing controls and cannot open customer content", async ({ page }) => {
  await openLogin(page);
  await submit(page);
  await expect(page.getByText(email.split("@")[0], { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Menu da conta" })).toHaveCount(0);
  await page.goto("/minha-conta");
  await expect(page.getByText(email.split("@")[0], { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Minha Conta", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: email.split("@")[0], exact: true }).hover();
  await expect(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
});

test("ADMIN reuses the account menu on storefront and detail with its own links and logout", async ({ page }) => {
  await openLogin(page);
  await submit(page);
  await expect(page).toHaveURL(/\/manager$/);
  await page.getByRole("link", { name: "Ver loja", exact: true }).click();
  const trigger = page.getByRole("button", { name: email.split("@")[0], exact: true });
  const menu = page.getByRole("navigation", { name: "Menu da conta" });
  await trigger.hover();
  await trigger.click();
  await expect(menu.locator("a, button")).toHaveText(["Minha Conta", "Painel Administrativo", "Sair"]);
  await expect(menu.getByRole("link", { name: "Favoritos" })).toHaveCount(0);
  await menu.getByRole("link", { name: "Minha Conta", exact: true }).click();
  await expect(page).toHaveURL(/\/minha-conta$/);
  await expect(page.getByRole("heading", { name: "Área de clientes" })).toBeVisible();
  await trigger.hover();
  await menu.getByRole("link", { name: "Painel Administrativo" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
  const products = await (await page.request.get("/api/produtos")).json();
  await page.goto(`/?productId=${products[0].id}`);
  await trigger.hover();
  await expect(menu.locator("a, button")).toHaveText(["Minha Conta", "Painel Administrativo", "Sair"]);
  await menu.getByRole("button", { name: "Sair", exact: true }).click();
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  await expect(trigger).toHaveCount(0);
});

test.describe("ADMIN mobile menu", () => {
test.use({ hasTouch: true });
test("ADMIN account menu opens by touch on mobile", async ({ page }) => {
  await openLogin(page);
  await submit(page);
  await expect(page).toHaveURL(/\/manager$/);
  await page.getByRole("link", { name: "Ver loja", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  const trigger = page.getByRole("button", { name: email.split("@")[0], exact: true });
  await trigger.tap();
  const menu = page.getByRole("navigation", { name: "Menu da conta" });
  await expect(menu.locator("a, button")).toHaveText(["Minha Conta", "Painel Administrativo", "Sair"]);
  await trigger.tap();
  await expect(menu).toBeHidden();
  await trigger.tap();
  await menu.getByRole("link", { name: "Painel Administrativo" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard", exact: true })).toBeVisible();
});
});

test.describe("mobile account menu", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test("touch menu works on small screens and closes outside", async ({ page }) => {
    await page.goto("http://127.0.0.1:4178/minha-conta");
    await page.getByRole("main").getByRole("button", { name: "Entrar", exact: true }).tap();
    await page.getByLabel("E-mail", { exact: true }).fill(userEmail);
    await page.getByLabel("Senha", { exact: true }).fill(userPassword);
    await submit(page);
    const trigger = page.getByRole("button", { name: "Cliente", exact: true });
    const menu = page.getByRole("navigation", { name: "Menu da conta" });
    await trigger.tap();
    await expect(menu).toBeVisible();
    await page.getByRole("heading", { name: "Minha Conta", exact: true }).tap();
    await expect(menu).toBeHidden();
    await trigger.tap();
    await menu.getByRole("link", { name: "Favoritos" }).tap();
    await expect(page.getByRole("heading", { name: "Favoritos", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

async function openLogin(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
}
async function submit(page: Page) {
  await page.locator('form button[type="submit"]').click();
}

test("real login with a five-character password, reload validation and logout", async ({ page }) => {
  await openLogin(page);
  await submit(page);
  await expect(page.getByText(email.split("@")[0], { exact: true }).first()).toBeVisible();
  const saved = await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!), storageKey);
  expect(typeof saved.accessToken).toBe("string");
  expect(saved.admin).toBeUndefined();
  expect(saved.password).toBeUndefined();
  const me = page.waitForResponse("**/api/auth/me");
  await page.reload();
  expect((await me).status()).toBe(200);
  await expect(page.getByText(email.split("@")[0], { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).first().click();
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  await page.reload();
  await expect(page.getByRole("button", { name: "Entrar", exact: true }).first()).toBeVisible();
});

test("incorrect password prevents login", async ({ page }) => {
  await openLogin(page);
  await page.getByLabel("Senha", { exact: true }).fill(password + "-incorrect");
  await submit(page);
  await expect(page.getByRole("alert")).toHaveText("E-mail ou senha inválidos.");
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
});

test("connection failure has a different message and never authenticates", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.abort("connectionrefused"));
  await openLogin(page);
  await submit(page);
  await expect(page.getByRole("alert")).toContainText("conectar ao serviço");
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
});

test("backend/database failure is not reported as incorrect credentials", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.fulfill({ status: 500, json: { error: "Erro ao autenticar administrador." } }));
  await openLogin(page);
  await submit(page);
  await expect(page.getByRole("alert")).toContainText("conectar ao serviço");
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
});

test("HTTP 200 with an invalid body does not authenticate", async ({ page }) => {
  await page.route("**/api/auth/login", route => route.fulfill({ status: 200, json: { success: true } }));
  await openLogin(page);
  await submit(page);
  await expect(page.getByRole("alert")).toContainText("resposta inválida");
  expect(await page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
});

test("old mock identity cannot log in and real public registration is available", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("brecho_user_v1", JSON.stringify({
    id: "fake", name: "Fake User", email: "fake@example.test"
  })));
  await openLogin(page);
  expect(await page.evaluate(() => localStorage.getItem("brecho_user_v1"))).toBeNull();
  await expect(page.getByRole("button", { name: "Cadastre-se" })).toBeVisible();
  await expect(page.getByText("Fake User", { exact: true })).toHaveCount(0);
});

test("customer and administrator use the same login form and expose their roles", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await page.getByLabel("E-mail", { exact: true }).fill(userEmail);
  await page.getByLabel("Senha", { exact: true }).fill(userPassword);
  const customerLogin = page.waitForResponse("**/api/auth/login");
  await submit(page);
  expect((await customerLogin).status()).toBe(200);
  await expect(page.getByText("Cliente", { exact: true }).first()).toBeVisible();
  expect((await (await page.request.get("/api/auth/me", {
    headers: { Authorization: "Bearer " + (await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).accessToken, storageKey)) }
  })).json()).account.role).toBe("USER");
  await page.getByRole("button", { name: "Cliente", exact: true }).hover();
  await page.getByRole("button", { name: "Sair", exact: true }).first().click();

  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await page.getByLabel("E-mail", { exact: true }).fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  const adminLogin = page.waitForResponse("**/api/auth/login");
  await submit(page);
  expect((await adminLogin).status()).toBe(200);
  await expect(page.getByText(email.split("@")[0], { exact: true }).first()).toBeVisible();
  expect((await (await page.request.get("/api/auth/me", {
    headers: { Authorization: "Bearer " + (await page.evaluate(key => JSON.parse(sessionStorage.getItem(key)!).accessToken, storageKey)) }
  })).json()).account.role).toBe("ADMIN");
});

test("a customer can create a PostgreSQL account and then log in", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await page.getByRole("button", { name: "Cadastre-se" }).click();
  await page.getByLabel("Nome completo").fill("Nova Cliente");
  await page.getByLabel("E-mail", { exact: true }).fill(registerEmail);
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura");
  const registration = page.waitForResponse("**/api/auth/register");
  await submit(page);
  expect((await registration).status()).toBe(201);
  await expect(page.getByRole("status")).toContainText("Conta criada");
  await page.getByLabel("Senha", { exact: true }).fill("senha-segura");
  await submit(page);
  await expect(page.getByText("Nova", { exact: true }).first()).toBeVisible();
});

test("session is not restored when /auth/me is unavailable", async ({ page }) => {
  await openLogin(page);
  await submit(page);
  await expect(page.getByText(email.split("@")[0], { exact: true }).first()).toBeVisible();
  await page.route("**/api/auth/me", route => route.abort("connectionrefused"));
  await page.reload();
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await expect(page.getByRole("alert")).toContainText("conectar ao serviço");
});

test("expired/rejected token is cleared on reload", async ({ page }) => {
  await openLogin(page);
  await submit(page);
  await expect(page.getByText(email.split("@")[0], { exact: true }).first()).toBeVisible();
  await page.route("**/api/auth/me", route => route.fulfill({ status: 401, json: { error: "Token inválido ou expirado." } }));
  await page.reload();
  await expect.poll(() => page.evaluate(key => sessionStorage.getItem(key), storageKey)).toBeNull();
  await page.getByRole("button", { name: "Entrar", exact: true }).first().click();
  await expect(page.getByRole("alert")).toContainText("sessão expirou");
});
