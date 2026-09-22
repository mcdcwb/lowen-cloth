import assert from "node:assert/strict";
import test from "node:test";
import { createManagerApi } from "../src/app/manager/api.ts";
import { productStats, toDraft, toInput, validateDraft, normalizeHex, LOW_STOCK_LIMIT, colorDraft } from "../src/app/manager/products.ts";
const color = { colorName: "Preto", colorValue: "#111111", images: [], imageUrl: "", variants: [] };
const draft = () => ({ ...toDraft(), name: "Produto teste", price: "19.90", colors: [colorDraft(color)] });
test("dashboard totals variants across colors and separates empty/low stock", () => {
  const products = [[], [0], [2, 3], [LOW_STOCK_LIMIT + 1]].map(stocks => ({ colors: stocks.map(stock => ({ variants: [{ value: "P", stock }] })) }));
  assert.deepEqual(productStats(products), { products: 4, variants: 4, empty: 2, low: 1 });
});
test("each color validates name, HEX and unique integer stocks; at least one color is required", () => {
  const d = draft();
  assert.notEqual(colorDraft().key, colorDraft().key);
  assert.deepEqual(validateDraft(d), []);
  assert.ok(validateDraft({ ...d, colors: [] }).length);
  for (const invalid of [{ colorName: " " }, { colorValue: "" }, { colorValue: "#123" }, { colorValue: "red" }])
    assert.ok(validateDraft({ ...d, colors: [{ ...d.colors[0], ...invalid }] }).length);
  for (const stock of ["", "-1", "1.5", "2147483648"]) assert.ok(validateDraft({ ...d, colors: [{ ...d.colors[0], variants: [{ value: "P", stock }] }] }).length);
  assert.match(validateDraft({ ...d, colors: [{ ...d.colors[0], variants: [{ value: " P ", stock: "1" }, { value: "P", stock: "2" }] }] }).join(), /duplicada/);
  const first = { ...d.colors[0], variants: [{ value: "P", stock: "3" }] };
  assert.deepEqual(validateDraft({ ...d, colors: [first, { ...first, key: "second", colorName: "Branco" }] }), []);
});
test("draft roundtrip retains color/variant IDs, separate images and a single price/badge", () => {
  const input = { ...toInput(draft()), id: 5, badge: "Novo", colors: [
    { ...color, id: 10, colorValue: "#abcdef", imageUrl: "/black.png", images: ["/back.png"], variants: [{ id: 20, value: "P", stock: 3 }] },
    { ...color, id: 11, colorName: "Branco", colorValue: "#ffffff", imageUrl: "/white.png", variants: [{ id: 21, value: "P", stock: 0 }] }
  ] };
  const output = toInput(toDraft(input));
  assert.equal(output.colors[0].id, 10); assert.equal(output.colors[0].variants[0].id, 20);
  assert.equal(output.colors[0].colorValue, "#ABCDEF"); assert.equal(output.colors[1].colorValue, "#FFFFFF");
  assert.deepEqual(output.colors[0].images, ["/back.png"]); assert.equal(output.colors[1].imageUrl, "/white.png");
  assert.equal(output.price, 19.9); assert.equal(output.badge, "Novo");
  assert.ok(output.colors.every(c => !("price" in c) && !("badge" in c)));
});
test("manager never saves placeholder images and sends nested JWT-protected CRUD", async () => {
  const input = toInput(draft()), calls = [];
  const raw = { ...input, id: 5, colors: [{ ...color, id: 10, imageUrl: null }] };
  const api = createManagerApi("verified-token", "/api/", async (url, init) => {
    calls.push({ url, init }); return new Response(JSON.stringify(init.method === "GET" ? [raw] : raw));
  });
  const [product] = await api.list();
  assert.equal(toDraft(product).colors[0].imageUrl, ""); assert.equal(toDraft(product).colors[0].images, "");
  await api.save(input); await api.save(input, 5); await api.remove(5);
  assert.deepEqual(calls.map(c => c.init.method), ["GET", "POST", "PUT", "DELETE"]);
  assert.ok(calls.every(c => c.init.headers.Authorization === "Bearer verified-token"));
  assert.deepEqual(JSON.parse(calls[2].init.body).colors[0].variants, []);
});
test("administrative API distinguishes denied access, validation and network errors", async () => {
  for (const status of [401, 403, 400, 500]) {
    const api = createManagerApi("token", "/api", async () => new Response(JSON.stringify({ error: "Falha" }), { status }));
    await assert.rejects(api.remove(1), { status });
  }
  const api = createManagerApi("token", "/api", async () => { throw new TypeError("offline"); });
  await assert.rejects(api.remove(1), { status: 0 });
});
test("HEX normalization accepts exactly six digits and preserves the color name", () => {
  for (const value of ["#1f2937", " #abcdef ", "#000000", "#FFFFFF"]) {
    const d = draft(); d.colors[0].colorValue = value;
    assert.equal(toInput(d).colors[0].colorValue, value.trim().toUpperCase());
    assert.equal(toInput(d).colors[0].colorName, "Preto");
  }
  for (const value of ["#123", "123456", "red", "#GG0000", "#12345678", "rgb(1,2,3)"]) assert.equal(normalizeHex(value), null);
});
