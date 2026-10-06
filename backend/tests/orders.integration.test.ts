import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { OrderStatus } from "../src/generated/prisma/enums.js";
import { createApp } from "../src/app.js";
import { createUser } from "../src/services/user.service.js";
import { createAdmin } from "../src/services/admin.service.js";
import { startTestServer } from "./helpers/http.js";
process.env.JWT_SECRET = randomBytes(32).toString("hex");
test("ADMIN order reads validate filters, pagination and historical snapshots", async t => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/lowen_test_/);
  const tag = randomUUID(), password = randomUUID(), email = `${tag}@example.test`, adminEmail = `admin-${tag}@example.test`;
  const address = { cep: "80000000", street: "Rua Histórica", number: "123", complement: "", neighborhood: "Centro", city: "Curitiba", state: "PR" };
  const storeAddress = { ...address, street: "Loja Histórica", number: "456" };
  const server = await startTestServer(createApp());
  try {
    const user = await createUser({ name: "Nome Atual", email, password });
    await createAdmin({ email: adminEmail, password });
    const login = async (email: string) => (await (await server.request("/auth/login", "POST", { email, password })).json()).accessToken;
    const admin = await login(adminEmail), customer = await login(email);
    const statuses = Object.values(OrderStatus);
    const orders = [];
    for (let i = 0; i < 25; i++) orders.push(await prisma.order.create({ data: {
      number: `2611${String(9000 + i).padStart(4, "0")}`, sequence: 9000 + i, userId: user.id,
      customerName: `${i % 2 ? "Maria" : "João"} ${tag}`, status: statuses[i % statuses.length],
      fulfillmentMethod: i % 2 ? "PICKUP" : "DELIVERY", deliveryAddress: i % 2 ? undefined : address,
      pickupAddress: i % 2 ? storeAddress : undefined, total: "258.00", idempotencyKey: randomUUID(), requestHash: "fixture",
      whatsappUrl: "https://wa.me/5541999999999", whatsappMessage: "fixture", createdAt: new Date(Date.UTC(2026, 9, 25 - i, 12)),
      items: { create: { originalVariantId: 42, productName: "Produto Histórico", colorName: "Branco", size: "GG", quantity: 2, unitPrice: "129.00", subtotal: "258.00" } }
    } }));
    await prisma.userAddress.create({ data: { userId: user.id, ...address, street: "Rua Atual" } });
    const read = async (query = "") => server.request(`/orders?search=${tag}${query}`, "GET", undefined, admin);
    await t.test("GUEST 401 and USER 403 for both list and details; ADMIN reads", async () => {
      for (const path of ["/orders", `/orders/${orders[0].id}`]) {
        assert.equal((await server.request(path)).status, 401);
        assert.equal((await server.request(path, "GET", undefined, customer)).status, 403);
        assert.equal((await server.request(path, "GET", undefined, admin)).status, 200);
      }
    });
    await t.test("default recent-first, all sort directions, and stable pagination", async () => {
      const first = await (await read()).json();
      assert.equal(first.items.length, 20); assert.equal(first.total, 25); assert.equal(first.totalPages, 2);
      assert.equal(first.items[0].id, orders[0].id);
      assert.ok(!("deliveryAddress" in first.items[0])); assert.ok(!("requestHash" in first.items[0]));
      const second = await (await read("&page=2")).json(); assert.equal(second.items.length, 5);
      assert.equal(new Set([...first.items, ...second.items].map(o => o.id)).size, 25);
      const clamped = await (await read("&page=999")).json(); assert.equal(clamped.page, 2);
      for (const sort of ["date", "number"]) for (const direction of ["asc", "desc"]) {
        const data = await (await read(`&sort=${sort}&direction=${direction}&pageSize=50`)).json();
        const expected = [...orders].sort((a, b) => (sort === "number" ? a.sequence - b.sequence : a.createdAt.getTime() - b.createdAt.getTime()) * (direction === "asc" ? 1 : -1));
        assert.deepEqual(data.items.map(o => o.id), expected.map(o => o.id));
      }
    });
    await t.test("number/name search, every status and combined criteria", async () => {
      const byNumber = await (await server.request(`/orders?search=%23${orders[0].number}`, "GET", undefined, admin)).json();
      assert.deepEqual(byNumber.items.map(o => o.id), [orders[0].id]);
      const byName = await (await server.request(`/orders?search=${encodeURIComponent(`mArIa ${tag}`)}&pageSize=50`, "GET", undefined, admin)).json();
      assert.equal(byName.total, 12);
      for (const status of statuses) {
        const filtered = await (await read(`&status=${status}`)).json();
        assert.equal(filtered.total, 5); assert.ok(filtered.items.every(o => o.status === status));
      }
      const combined = await (await server.request(`/orders?search=${encodeURIComponent(`maria ${tag}`)}&status=PREPARING&sort=number&direction=desc&pageSize=1&page=2`, "GET", undefined, admin)).json();
      assert.equal(combined.total, 3); assert.equal(combined.items.length, 1); assert.equal(combined.page, 2);
      assert.equal(combined.items[0].sequence, 9011);
      const empty = await (await server.request("/orders?status=CANCELLED&search=nonexistent-order-name", "GET", undefined, admin)).json();
      assert.deepEqual(empty.items, []); assert.equal(empty.total, 0); assert.equal(empty.page, 1); assert.equal(empty.totalPages, 1);
    });
    await t.test("invalid parameters and IDs are rejected", async () => {
      for (const query of ["sort=price", "direction=sideways", "status=PAID", "page=0", "page=1.5", "page=1000001", "pageSize=51", "pageSize=0", "foo=bar", "sort=date&sort=number", "search=a&search=b", "search=" + "a".repeat(101)])
        assert.equal((await server.request(`/orders?${query}`, "GET", undefined, admin)).status, 400, query);
      assert.equal((await server.request("/orders/invalid", "GET", undefined, admin)).status, 400);
      assert.equal((await server.request("/orders/2147483647", "GET", undefined, admin)).status, 404);
    });
    await t.test("details use snapshots only and omit internal checkout/security fields", async () => {
      for (const index of [0, 1]) {
        const detail = await (await server.request(`/orders/${orders[index].id}`, "GET", undefined, admin)).json();
        assert.equal(detail.customerName, orders[index].customerName); assert.equal(detail.total, "258");
        assert.deepEqual(detail.deliveryAddress, index === 0 ? address : null);
        assert.deepEqual(detail.pickupAddress, index === 1 ? storeAddress : null);
        assert.equal(detail.items[0].productName, "Produto Histórico"); assert.equal(detail.items[0].unitPrice, "129");
        for (const field of ["requestHash", "idempotencyKey", "whatsappUrl", "whatsappMessage", "user", "userId"]) assert.ok(!(field in detail));
      }
    });
  } finally {
    await server.close(); await prisma.order.deleteMany({ where: { user: { email } } });
    await prisma.user.deleteMany({ where: { email } }); await prisma.admin.deleteMany({ where: { email: adminEmail } });
    await prisma.$disconnect();
  }
});
