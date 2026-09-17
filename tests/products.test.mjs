import assert from "node:assert/strict";
import test from "node:test";
import { adaptProduct, catalogSizes, stockFor, productImagePlaceholder } from "../src/app/lib/products.ts";

const input = {
  id: 1, name: "Produto real", price: "129.90", public: "unissex", category: "camisetas",
  description: null, images: [], imageUrl: null, colorName: null, colorValue: null, badge: null,
  variants: [{ value: "P", stock: 0 }, { value: "39", stock: 2 }, { value: "Sob medida", stock: 1 }]
};

test("adapter converts Prisma Decimal and nullable fields without inventing stock", () => {
  const product = adaptProduct(input);
  assert.equal(product.price, 129.9);
  assert.equal(product.public, "unissex");
  assert.equal(product.category, "camisetas");
  assert.deepEqual(product.sizes, ["P", "39", "Sob medida"]);
  assert.equal(stockFor(product, "P"), 0);
  assert.equal(stockFor(product, "39"), 2);
  assert.equal(stockFor(product, "missing"), 0);
  assert.equal(product.imageUrl, productImagePlaceholder);
  assert.deepEqual(product.images, [productImagePlaceholder]);
});

test("adapter keeps image order, removes duplicates and maps color and description", () => {
  const product = adaptProduct({ ...input, imageUrl: "/front.jpg", images: ["/back.jpg", "/front.jpg", ""],
    colorName: "Azul", colorValue: "#123456", description: "Algodão", badge: "Novo" });
  assert.deepEqual(product.images, ["/front.jpg", "/back.jpg"]);
  assert.deepEqual(product.color, { name: "Azul", value: "#123456" });
  assert.equal(product.description, "Algodão");
  assert.equal(product.badge, "Novo");
});

test("invalid prices, response shapes and variant stocks are rejected", () => {
  for (const price of [null, "", "abc", -1, 0, Infinity]) assert.throws(() => adaptProduct({ ...input, price }));
  for (const stock of [-1, 0.5, "3", null]) {
    assert.throws(() => adaptProduct({ ...input, variants: [{ value: "P", stock }] }));
  }
  assert.throws(() => adaptProduct({ ...input, variants: [{ value: "P", stock: 1 }, { value: "P", stock: 2 }] }));
  assert.throws(() => adaptProduct({ ...input, images: null }));
  assert.throws(() => adaptProduct(null));
});

test("size options are derived from variants and sort numbers naturally", () => {
  const product = adaptProduct({ ...input, variants: ["40", "M", "P", "8", "38", "Único"].map(value => ({ value, stock: 1 })) });
  assert.deepEqual(catalogSizes([product, product]), ["P", "M", "Único", "8", "38", "40"]);
  assert.deepEqual(catalogSizes([]), []);
});

test("catalog sizes exclude sold-out variants, deduplicate and retain unknown sizes before numbers", () => {
  const product = adaptProduct({ ...input, variants: ["10", "9", "8", "GG", "XG", "PP", "P", "M", "G", "Sob medida", "A2"].map(value => ({ value, stock: 1 })) });
  const soldOut = adaptProduct({ ...input, variants: [{ value: "36", stock: 0 }] });
  assert.deepEqual(catalogSizes([product, product, soldOut]), ["PP", "P", "M", "G", "GG", "XG", "A2", "Sob medida", "8", "9", "10"]);
  assert.deepEqual(catalogSizes([soldOut]), []);
});
