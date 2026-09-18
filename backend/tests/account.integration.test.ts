import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { prisma } from "../src/lib/prisma.js";
import { createApp } from "../src/app.js";
import { createUser } from "../src/services/user.service.js";
import { createAdmin } from "../src/services/admin.service.js";
import { startTestServer } from "./helpers/http.js";
process.env.JWT_SECRET = randomBytes(32).toString("hex");

test("customer profile, address and password use the authenticated identity", async t => {
    const suffix = randomUUID();
    const emails = ["a", "b", "admin", "changed", "race"].map(name => `${name}-${suffix}@example.test`);
    const password = "old-" + suffix, newPassword = "new-" + suffix;
    const server = await startTestServer(createApp());
    let productId: number | undefined;
    let userIds: number[] = [];
    try {
        const a = await createUser({ name: "Nome Completo Original", email: emails[0], password });
        const b = await createUser({ name: "Outra Pessoa", email: emails[1], password });
        userIds = [a.id, b.id];
        await createAdmin({ email: emails[2], password });
        const login = async (email: string, secret = password) => server.request("/auth/login", "POST", { email, password: secret });
        const token = (await (await login(emails[0])).json()).accessToken;
        const bToken = (await (await login(emails[1])).json()).accessToken;
        const adminToken = (await (await login(emails[2])).json()).accessToken;
        const req = (path = "/conta", method = "GET", body?: unknown, accessToken = token) => server.request(path, method, body, accessToken);
        const address = { cep: "01001-000", street: "Praça da Sé", number: "10", complement: "", neighborhood: "Sé", city: "São Paulo", state: "sp" };
        const product = await prisma.product.create({ data: { name: "Account fixture", price: 10, public: "unissex", category: "camisetas", images: [], variants: { create: { value: "P", stock: 2 } } } });
        productId = product.id;
        assert.equal((await req(`/favoritos/${product.id}`, "PUT")).status, 200);
        assert.equal((await req("/carrinho", "POST", { productId, size: "P", quantity: 1 })).status, 200);
        await t.test("real name/email, optional address and no password hash exposure", async () => {
            const result = await req();
            assert.equal(result.status, 200);
            assert.deepEqual(await result.json(), { account: { ...a, role: "USER" }, address: null });
            assert.equal((await req("/conta", "PATCH", { email: emails[0], address: null })).status, 200);
            for (const extra of [{ name: "Hacked" }, { userId: b.id }, { role: "ADMIN" }, { passwordHash: "fake" }]) {
                assert.equal((await req("/conta", "PATCH", { email: emails[0], address: null, ...extra })).status, 400);
            }
            assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).name, a.name);
        });
        await t.test("email normalizes, rejects User/Admin duplicates, and /auth/me reflects changes", async () => {
            for (const email of [emails[1], emails[2]]) assert.equal((await req("/conta", "PATCH", { email, address: null })).status, 409);
            assert.equal((await req("/conta", "PATCH", { email: "invalid", address: null })).status, 400);
            const saved = await req("/conta", "PATCH", { email: `  ${emails[3].toUpperCase()}  `, address: null });
            assert.equal(saved.status, 200);
            assert.equal((await saved.json()).account.email, emails[3]);
            assert.equal((await (await req("/auth/me")).json()).account.email, emails[3]);
            assert.equal((await login(emails[0])).status, 401);
            assert.equal((await login(emails[3])).status, 200);
        });
        await t.test("complete addresses validate, persist, edit and can be cleared", async () => {
            for (const invalid of [{}, { ...address, number: "" }, { ...address, state: "ZZ" }, { ...address, cep: "123" }, { ...address, userId: b.id }]) {
                assert.equal((await req("/conta", "PATCH", { email: emails[3], address: invalid })).status, 400);
            }
            assert.equal((await req("/conta", "PATCH", { email: emails[3], address })).status, 200);
            assert.deepEqual((await (await req()).json()).address, { ...address, cep: "01001000", state: "SP" });
            assert.equal((await req("/conta", "PATCH", { email: emails[3], address: { ...address, number: "12", complement: "Apto 2" } })).status, 200);
            assert.equal((await (await req()).json()).address.complement, "Apto 2");
            const { complement: _, ...withoutComplement } = address;
            assert.equal((await req("/conta", "PATCH", { email: emails[3], address: withoutComplement })).status, 200);
            assert.equal((await (await req()).json()).address.complement, "");
            assert.equal((await req("/conta", "PATCH", { email: emails[3], address: null })).status, 200);
            assert.equal((await (await req()).json()).address, null);
        });
        await t.test("cannot read or alter another account; visitor/admin rejected", async () => {
            assert.equal((await (await req(`/conta?userId=${b.id}`)).json()).account.id, a.id);
            assert.equal((await req(`/conta/${b.id}`, "PATCH", { email: emails[3], address })).status, 404);
            for (const [method, path, body] of [["GET", "/conta", undefined], ["PATCH", "/conta", { email: emails[3], address }], ["PUT", "/conta/senha", { currentPassword: password, newPassword, confirmPassword: newPassword }]] as const) {
                assert.equal((await server.request(path, method, body)).status, 401);
                assert.equal((await req(path, method, body, adminToken)).status, 403);
            }
            assert.deepEqual((await (await req("/conta", "GET", undefined, bToken)).json()), { account: { ...b, role: "USER" }, address: null });
        });
        await t.test("password verification, confirmation, hashing and login after change", async () => {
            const body = { currentPassword: password, newPassword, confirmPassword: newPassword };
            for (const invalid of [{ ...body, currentPassword: "incorrect" }, { ...body, confirmPassword: "different" }, { ...body, newPassword: "1234", confirmPassword: "1234" }, { ...body, userId: b.id }]) {
                const response = await req("/conta/senha", "PUT", invalid);
                assert.equal(response.status, 400);
                const text = await response.text();
                assert.ok(!text.includes(password) && !text.includes(newPassword));
            }
            const response = await req("/conta/senha", "PUT", body);
            assert.equal(response.status, 200);
            assert.deepEqual(await response.json(), { message: "Senha alterada com sucesso." });
            assert.equal((await login(emails[3])).status, 401);
            assert.equal((await login(emails[3], newPassword)).status, 200);
            assert.equal((await login(emails[1])).status, 200);
            assert.match((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).passwordHash, /^\$argon2id\$/);
        });
        await t.test("favorites/cart remain linked when profile changes", async () => {
            await req("/conta", "PATCH", { email: emails[3], address });
            const newToken = (await (await login(emails[3], newPassword)).json()).accessToken;
            assert.equal((await (await req("/favoritos", "GET", undefined, newToken)).json())[0].product.id, product.id);
            assert.equal((await (await req("/carrinho", "GET", undefined, newToken)).json()).items[0].product.id, product.id);
        });
        await t.test("email update races with admin creation without cross-table duplicates", async () => {
            const results = await Promise.allSettled([
                req("/conta", "PATCH", { email: emails[4], address: null }),
                createAdmin({ email: emails[4], password })
            ]);
            assert.equal(await prisma.user.count({ where: { email: emails[4] } }) + await prisma.admin.count({ where: { email: emails[4] } }), 1);
            const update = results[0];
            assert.equal(update.status, "fulfilled");
            if (update.status === "fulfilled") assert.ok([200, 409].includes(update.value.status));
        });
    } finally {
        if (productId) await prisma.product.deleteMany({ where: { id: productId } });
        await prisma.user.deleteMany({ where: { id: { in: userIds } } });
        await prisma.admin.deleteMany({ where: { email: { in: emails } } });
        await server.close();
        await prisma.$disconnect();
    }
});
