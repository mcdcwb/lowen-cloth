import { test, expect } from "@playwright/test";

const squaredShape = "M0,507.7H1394.5c132.4,0,397.5,386.7,397.5,386.7s-265.1,389.9-397.5,389.9H0V507.7z";

for (const touch of [false, true]) for (const width of [320, 390, 768, 1440]) {
  test.describe(`badge ${touch ? "touch" : "desktop"} ${width}`, () => {
    test.use({ viewport: { width, height: 1000 }, hasTouch: touch, isMobile: touch });
    test("half-height, whole-card reveal, explicit variants and fixed manual slot", async ({ page }, info) => {
      const products = [1, 3].map((stock, index) => ({ id: 9700 + index, name: `Badge motion ${index}`, price: 30, public: "unissex", category: "camisetas", badge: "MANUAL", badgeBackgroundColor: "#2457A7", badgeTextColor: "#FFFFFF",
        colors: [{ id: 9700 + index, colorName: "Preto", colorValue: "#111111", images: ["/badge-motion-light.svg", "/badge-motion-dark.svg"], variants: [{ id: 9700 + index, value: "P", stock }, { id: 9800 + index, value: "G", stock: 10 }] }] }));
      await page.route("**/api/produtos", route => route.fulfill({ json: products }));
      await page.route("**/api/settings/public", route => route.fulfill({ json: { address: null, whatsapp: null, lowStockThreshold: 5, showLowStockBadge: true, showLastUnitBadge: true } }));
      await page.route("**/badge-motion-*.svg", route => route.fulfill({ contentType: "image/svg+xml", body: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><rect width="400" height="500" fill="${route.request().url().includes("light") ? "#eeeeee" : "#111111"}"/></svg>` }));
      await page.goto("/");
      const cards = page.locator(".store-product-card");
      const card = cards.first(), automatic = card.locator(".store-badge-automatic"), other = cards.nth(1).locator(".store-badge-automatic"), manual = card.locator(".store-badge-manual");
      await expect(page.locator(".store-badge-automatic")).toHaveCount(0);
      for (const current of [card, cards.nth(1)]) {
        await current.getByRole("button", { name: "P", exact: true }).click();
        await expect(current.locator(".store-badge-automatic")).toHaveCount(0);
        await current.getByRole("button", { name: "Preto", exact: true }).click();
      }
      await card.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120));
      await page.mouse.move(0, 0);
      await expect(automatic).toHaveAttribute("role", "note");
      await expect(automatic).toHaveAccessibleName("ÚLTIMA PEÇA");
      await expect(other).toHaveAccessibleName("POUCAS UNIDADES");
      await expect(manual).not.toHaveAttribute("tabindex");
      for (const badge of [automatic, other, manual]) {
        await expect(badge.locator("path")).toHaveAttribute("d", squaredShape);
        await expect(badge).toHaveCSS("border-radius", "0px");
        await expect(badge.locator("svg")).toHaveAttribute("viewBox", "0 0 1792 1792");
      }
      for (const badge of [automatic, other]) {
        const size = await badge.boundingBox();
        expect(size!.height).toBeCloseTo(size!.width * 776.6 / 1792 / 2, 1);
        await expect(badge.locator("svg")).toHaveAttribute("preserveAspectRatio", "none");
      }
      const manualSize = await manual.boundingBox();
      expect(manualSize!.height).toBeCloseTo(manualSize!.width * 776.6 / 1792, 1);
      const retracted = () => automatic.evaluate(el => {
        const matrix = new DOMMatrixReadOnly(getComputedStyle(el).transform);
        return Math.abs(matrix.m41 / el.getBoundingClientRect().width + 0.72) < 0.001;
      });
      if (touch) await expect(automatic).toHaveCSS("transform", "none");
      else {
        await expect.poll(retracted).toBe(true);
        await card.getByText("Badge motion 0", { exact: true }).hover();
        await expect(automatic).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
        await page.mouse.move(0, 0); await expect.poll(retracted).toBe(true);
      }
      const original = await card.evaluate(el => {
        const photo = el.firstElementChild!.getBoundingClientRect(), outer = el.getBoundingClientRect(), manual = el.querySelector(".store-badge-manual")!.getBoundingClientRect();
        return { width: photo.width, height: photo.height, cardHeight: outer.height, manualTop: manual.top - photo.top, manualLeft: manual.left - outer.left };
      });
      expect(original.manualLeft).toBeCloseTo(0, 2);
      expect(original.height).toBeCloseTo(original.width * 1.25, 1);
      await card.screenshot({ path: info.outputPath("badge-retracted-light.png") });
      await expect(manual).toHaveCSS("transform", "none");
      await manual.hover({ force: true });
      await expect(manual).toHaveCSS("transform", "none");
      if (!touch) {
        await page.mouse.move(0, 0); await expect.poll(retracted).toBe(true);
        // Hover the painted tab, not the off-card bounding box's center.
        const photo = await card.locator(".store-product-photo").boundingBox();
        const badge = await automatic.boundingBox();
        await page.mouse.move(photo!.x - 1 + badge!.width * 0.12, badge!.y + badge!.height / 2);
        await expect(automatic).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
        await expect(other).not.toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
        await expect(automatic).toHaveCSS("transition-duration", "0.225s, 0.225s");
        const expanded = await automatic.boundingBox();
        expect(expanded!.width).toBeCloseTo(badge!.width, 2); expect(expanded!.height).toBeCloseTo(badge!.height, 2);
        const outer = await card.boundingBox(); expect(expanded!.x - outer!.x).toBeCloseTo(0, 2);
        await card.screenshot({ path: info.outputPath("badge-expanded-light.png") });
        for (const target of [card.getByRole("img"), card.getByText("R$ 30,00", { exact: true }), card.getByRole("button", { name: "Adicionar ao carrinho", exact: true })]) {
          await target.hover();
          await expect(automatic).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
          await expect(other).not.toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)");
        }
        await page.mouse.move(0, 0); await expect.poll(retracted).toBe(true);
      }
      await automatic.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
      await expect(automatic).toBeFocused();
      await expect(automatic).toHaveCSS("outline-style", "solid");
      await expect(automatic).toHaveCSS("transform", touch ? "none" : "matrix(1, 0, 0, 1, 0, 0)");
      const clipping = await automatic.evaluate(el => ({ photo: getComputedStyle(el.closest(".store-product-photo")!).overflow, card: getComputedStyle(el.closest(".store-product-card")!).overflow, image: getComputedStyle(el.closest(".store-product-photo")!.querySelector("a")!).overflow }));
      expect(clipping).toEqual({ photo: "visible", card: "visible", image: "hidden" });
      await card.getByRole("button", { name: "G", exact: true }).click();
      await expect(automatic).toHaveCount(0);
      expect(await manual.evaluate(el => el.getBoundingClientRect().top - el.closest(".store-product-photo")!.getBoundingClientRect().top)).toBeCloseTo(original.manualTop, 2);
      await card.getByRole("button", { name: "P", exact: true }).click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(automatic).toHaveCSS("transition-duration", "0s");
      await card.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120));
      await card.getByRole("img").hover();
      await card.getByRole("button", { name: "Próxima imagem", exact: true }).focus();
      await page.keyboard.press("Enter");
      await expect(card.getByRole("img")).toHaveAttribute("src", "/badge-motion-dark.svg");
      await automatic.focus(); await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
      await card.evaluate(el => window.scrollTo(0, window.scrollY + el.getBoundingClientRect().top - 120));
      await card.screenshot({ path: info.outputPath("badge-expanded-dark.png") });
      const final = await card.evaluate(el => {
        const photo = el.firstElementChild!.getBoundingClientRect(), outer = el.getBoundingClientRect();
        return { width: photo.width, height: photo.height, cardHeight: outer.height };
      });
      expect(final.width).toBeCloseTo(original.width, 2);
      expect(final.height).toBeCloseTo(original.height, 2);
      expect(final.cardHeight).toBeCloseTo(original.cardHeight, 2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const clear = await cards.evaluateAll(elements => {
        const overlaps = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const controls = elements.flatMap(el => [...el.querySelectorAll(".store-product-photo button")].map(button => button.getBoundingClientRect()));
        return elements.flatMap(el => [...el.querySelectorAll(".product-tag")].flatMap(badge => {
          const bounds = badge.getBoundingClientRect();
          const clip = getComputedStyle(badge).clipPath;
          const left = clip.startsWith("inset(") ? parseFloat(clip.slice(6, -1).split(" ")[3] ?? "0") / 100 : 0;
          const painted = new DOMRect(bounds.x + bounds.width * left, bounds.y, bounds.width * (1 - left), bounds.height);
          return controls.filter(control => overlaps(painted, control)).map(control => ({ label: badge.textContent, clip, painted: painted.toJSON(), control: control.toJSON() }));
        }));
      });
      expect(clear).toEqual([]);
    });
  });
}
