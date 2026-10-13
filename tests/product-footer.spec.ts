import { test, expect, type Page } from "@playwright/test";

const products = [101, 100].map(id => ({
  id, name: `Footer ${id}`, price: 30, public: "unissex", category: "camisetas", isPublished: true,
  colors: [{ id: id * 10, colorName: "Preto", colorValue: "#111111", images: ["/related-front.svg"], variants: [{ id: id * 10, value: "P", stock: 5 }] }]
}));

async function setup(page: Page) {
  await page.route("**/api/produtos", route => route.fulfill({ json: products }));
  await page.route("**/api/produtos/carrossel", route => route.fulfill({ json: [] }));
  await page.route("**/api/settings/public", route => route.fulfill({ json: { address: null, whatsapp: null } }));
  await page.route("**/related-front.svg", route => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="#ddd"/></svg>' }));
}

for (const width of [320, 390, 768, 1440]) test(`store footer appears once after detail and on Home at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await setup(page);
  const footer = page.locator("footer#contato");

  await page.goto("/?productId=100");
  await expect(page.getByRole("heading", { name: "Footer 100", exact: true })).toBeVisible();
  await expect(footer).toHaveCount(1);
  await expect(footer).toContainText("Contato");
  const detailBottom = await page.locator(".store-product-card").first().evaluate(el => el.getBoundingClientRect().bottom + window.scrollY);
  const relatedBottom = await page.locator("#related-products-title").evaluate(el => el.parentElement!.getBoundingClientRect().bottom + window.scrollY);
  const footerTop = await footer.evaluate(el => el.getBoundingClientRect().top + window.scrollY);
  expect(footerTop).toBeGreaterThanOrEqual(detailBottom);
  expect(footerTop).toBeGreaterThanOrEqual(relatedBottom);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.locator(".store-product-card").last().getByRole("img").click();
  await expect(page).toHaveURL(/productId=101/);
  await expect(footer).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Footer 101", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Voltar para a loja" }).click();
  await expect(page).toHaveURL("/");
  await expect(footer).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Footer 100", exact: true })).toHaveCount(0);
});
