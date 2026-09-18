import assert from "node:assert/strict";
import test from "node:test";
import { createManagerApi } from "../src/app/manager/api.ts";
import { productStats, toDraft, toInput, validateDraft, normalizeHex, LOW_STOCK_LIMIT } from "../src/app/manager/products.ts";

test("dashboard sums variants and separates empty from low stock", () => {
  const products = [[], [0], [2, 3], [LOW_STOCK_LIMIT + 1]].map(stocks => ({ variants: stocks.map(stock => ({ value: String(stock), stock })) }));
  assert.deepEqual(productStats(products), { products: 4, variants: 4, empty: 2, low: 1 });
});

test("form accepts arbitrary variants, rejects duplicates and invalid stock", () => {
  const draft = { ...toDraft(), name: "Camiseta teste", price: "129.90", variants: [{ value: "Sob medida", stock: "0" }, { value: "38", stock: "4" }] };
  assert.deepEqual(validateDraft(draft), []);
  assert.equal(toInput(draft).price, 129.9);
  assert.equal(toInput(draft).variants[1].stock, 4);
  assert.match(validateDraft({ ...draft, variants: [{ value: " P ", stock: "1" }, { value: "P", stock: "2" }] }).join(), /duplicada/);
  for (const stock of ["", "-1", "1.5", "2147483648"]) assert.ok(validateDraft({ ...draft, variants: [{ value: "M", stock }] }).length);
  assert.deepEqual(toInput({ ...draft, variants: [] }).variants, []);
  assert.equal(toInput(draft).badge, null);
});

test("editing preserves optional fields and raw image paths without saving placeholders", async () => {
  const raw = { id: 5, name: "Produto teste", description: null, price: "99.9", public: "unissex", category: "camisetas", imageUrl: null, images: [], badge: null, colorName: null, colorValue: null, variants: [] };
  const api = createManagerApi("token", "/api", async () => new Response(JSON.stringify([raw])));
  const [product] = await api.list();
  const draft = toDraft(product);
  assert.equal(draft.imageUrl, "");
  assert.equal(draft.images, "");
  assert.deepEqual(toInput(draft).variants, []);
});

test("administrative requests send JWT and preserve the full variant replacement contract", async () => {
  const calls = [];
  const input = toInput({ ...toDraft(), name: "Produto teste", price: "10", variants: [] });
  const api = createManagerApi("verified-token", "/api/", async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ ...input, id: 9 }));
  });
  await api.save(input);
  await api.save(input, 9);
  await api.remove(9);
  assert.deepEqual(calls.map(call => call.init.method), ["POST", "PUT", "DELETE"]);
  assert.deepEqual(calls.map(call => call.url), ["/api/produtos", "/api/produtos/9", "/api/produtos/9"]);
  assert.ok(calls.every(call => call.init.headers.Authorization === "Bearer verified-token"));
  assert.deepEqual(JSON.parse(calls[1].init.body).variants, []);
});

test("administrative API distinguishes denied access, validation and network errors", async () => {
  for (const status of [401, 403, 400, 500]) {
    const api = createManagerApi("token", "/api", async () => new Response(JSON.stringify({ error: "Falha" }), { status }));
    await assert.rejects(api.remove(1), { status });
  }
  const api = createManagerApi("token", "/api", async () => { throw new TypeError("offline"); });
  await assert.rejects(api.remove(1), { status: 0 });
});

test("product color validates six-digit HEX, normalizes and stays optional without changing its name", () => {
  const draft = { ...toDraft(), name: "Produto cor", price: "10", variants: [], colorName: "Off White" };
  for (const colorValue of ["#1f2937", " #abcdef ", "#000000", "#FFFFFF"]) {
    assert.deepEqual(validateDraft({ ...draft, colorValue }), []);
    assert.equal(toInput({ ...draft, colorValue }).colorValue, colorValue.trim().toUpperCase());
    assert.equal(toInput({ ...draft, colorValue }).colorName, "Off White");
    assert.equal(toDraft({ ...toInput({ ...draft, colorValue }), id: 1 }).colorValue, colorValue.trim().toUpperCase());
  }
  for (const colorValue of ["#123", "123456", "red", "#GG0000", "#12345678", "rgb(1,2,3)"]) {
    assert.equal(normalizeHex(colorValue), null);
    assert.match(validateDraft({ ...draft, colorValue }).join(), /#RRGGBB/);
  }
  assert.deepEqual(validateDraft(draft), []);
  assert.equal(toInput(draft).colorValue, null);
});
