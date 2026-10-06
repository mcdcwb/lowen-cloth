import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { prisma } from "../src/lib/prisma.js";
import { createApp } from "../src/app.js";
import { createAdmin } from "../src/services/admin.service.js";
import { createUser } from "../src/services/user.service.js";
import { startTestServer } from "./helpers/http.js";

process.env.JWT_SECRET = randomBytes(32).toString("hex");
test("global settings default, validation, ADMIN authorization and persistence in an isolated schema", async () => {
  const schema = "settings_test_" + randomUUID().replaceAll("-", "");
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  const isolated = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }, { schema }) });
  const email = randomUUID() + "@example.test", userEmail = randomUUID() + "@example.test", password = randomUUID();
  const server = await startTestServer(createApp({ settingsDatabase: isolated }));
  const original = await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } });
  try {
    await db.query(`CREATE SCHEMA "${schema}"`);
    await db.query(`SET search_path TO "${schema}"`);
    await db.query(await readFile("prisma/migrations/20261001000000_store_settings/migration.sql", "utf8"));
    await db.query(await readFile("prisma/migrations/20261005000000_store_business_details/migration.sql", "utf8"));
    await createAdmin({ email, password });
    await createUser({ name: "Settings Test", email: userEmail, password });
    const admin = (await (await server.request("/auth/login", "POST", { email, password })).json()).accessToken;
    const user = (await (await server.request("/auth/login", "POST", { email: userEmail, password })).json()).accessToken;
    for (const method of ["GET", "PUT"]) for (const [token, status] of [[undefined, 401], [user, 403]] as const)
      assert.equal((await server.request("/settings", method, method === "PUT" ? { lowStockThreshold: 10 } : undefined, token)).status, status);
    assert.deepEqual(await (await server.request("/settings", "GET", undefined, admin)).json(), { lowStockThreshold: 5 });
    for (const lowStockThreshold of [0, -1, 1.5, 10000, "5", "", null, "NaN"])
      assert.equal((await server.request("/settings", "PUT", { lowStockThreshold }, admin)).status, 400);
    for (const body of [{}, { lowStockThreshold: 10, id: 2 }]) assert.equal((await server.request("/settings", "PUT", body, admin)).status, 400);
    for (const value of [1, 9999, 10]) {
      const response = await server.request("/settings", "PUT", { lowStockThreshold: value }, admin);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { lowStockThreshold: value });
      assert.deepEqual(await (await server.request("/settings", "GET", undefined, admin)).json(), { lowStockThreshold: value });
      assert.equal((await db.query('SELECT "lowStockThreshold" FROM "StoreSettings" WHERE id=1')).rows[0].lowStockThreshold, value);
    }
    const address = { cep: "80000-000", street: "Rua Teste", number: "123", complement: "Sala 2", neighborhood: "Centro", city: "Curitiba", state: "pr" };
    const details = { address, whatsapp: "(41) 99999-9999" };
    for (const method of ["GET", "PUT"]) for (const [token, status] of [[undefined, 401], [user, 403]] as const)
      assert.equal((await server.request("/settings/store", method, method === "PUT" ? details : undefined, token)).status, status);
    assert.deepEqual(await (await server.request("/settings/public")).json(), { address: null, whatsapp: null });
    for (const method of ["PUT", "POST", "PATCH", "DELETE"])
      assert.equal((await server.request("/settings/public", method, details, admin)).status, 405);
    for (const body of [ { ...details, whatsapp: "abc" }, { ...details, whatsapp: "123" }, { ...details, address: { ...address, cep: "123" } },
      { ...details, address: { ...address, street: "" } }, { ...details, address: { ...address, state: "ZZ" } }, { ...details, lowStockThreshold: 50 } ])
      assert.equal((await server.request("/settings/store", "PUT", body, admin)).status, 400);
    const expected = { address: { ...address, cep: "80000000", state: "PR" }, whatsapp: "5541999999999" };
    assert.deepEqual(await (await server.request("/settings/store", "PUT", details, admin)).json(), expected);
    assert.deepEqual(await (await server.request("/settings/public")).json(), expected);
    assert.deepEqual(await (await server.request("/settings/store", "GET", undefined, admin)).json(), expected);
    assert.equal((await isolated.storeSettings.findUniqueOrThrow({ where: { id: 1 } })).whatsapp, expected.whatsapp);
    assert.equal((await isolated.storeSettings.findUniqueOrThrow({ where: { id: 1 } })).lowStockThreshold, 10);
    await server.request("/settings", "PUT", { lowStockThreshold: 10 }, admin);
    assert.deepEqual(await (await server.request("/settings/public")).json(), expected);
    await server.request("/settings/store", "PUT", { address: null, whatsapp: null }, admin);
    assert.deepEqual(await (await server.request("/settings/public")).json(), { address: null, whatsapp: null });
    const otherSession = (await (await server.request("/auth/login", "POST", { email, password })).json()).accessToken;
    assert.deepEqual(await (await server.request("/settings", "GET", undefined, otherSession)).json(), { lowStockThreshold: 10 });
    await assert.rejects(db.query('INSERT INTO "StoreSettings" (id) VALUES (2)'));
    await assert.rejects(db.query('UPDATE "StoreSettings" SET "lowStockThreshold"=0'));
    assert.deepEqual(await prisma.storeSettings.findUniqueOrThrow({ where: { id: 1 } }), original);
  } finally {
    await server.close();
    await isolated.$disconnect();
    await prisma.admin.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email: userEmail } });
    await db.query("SET search_path TO public");
    await db.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.end();
    await prisma.$disconnect();
  }
});
