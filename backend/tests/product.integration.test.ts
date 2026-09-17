import "dotenv/config";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { randomBytes, randomUUID } from "node:crypto";
import { createApp } from "../src/app.js";
import { createAdmin } from "../src/services/admin.service.js";
import { prisma } from "../src/lib/prisma.js";
process.env.JWT_SECRET = randomBytes(32).toString("hex");

const values = (variants: { value: string; stock: number }[]) =>
    variants.map(({ value, stock }) => ({ value, stock })).sort((a, b) => a.value.localeCompare(b.value));

test("product routes preserve the CRUD HTTP contract with PostgreSQL", async () => {
    const app = createApp();
    const email = "crud-" + randomUUID() + "@example.test";
    const password = "Test-only-password-" + randomUUID();
    const server = app.listen(0, "127.0.0.1");
    let productId: number | undefined;
    try {
        await once(server, "listening");
        const address = server.address();
        assert.ok(address && typeof address === "object");
        const baseUrl = "http://127.0.0.1:" + address.port + "/produtos";
        await createAdmin({ email, password });
        const login = await fetch("http://127.0.0.1:" + address.port + "/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });
        assert.equal(login.status, 200);
        const { accessToken } = await login.json();
        const request = (path: string, method = "GET", body?: unknown) => fetch(baseUrl + path, {
            method,
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + accessToken },
            body: body === undefined ? undefined : JSON.stringify(body)
        });

        let response = await request("", "POST", { name: "ab", price: -1, variants: [{ value: "P", stock: -1 }] });
        assert.equal(response.status, 400);
        assert.ok(Array.isArray((await response.json()).errors));
        for (const method of ["PUT", "DELETE"]) {
            response = await request("/invalid", method, {});
            assert.equal(response.status, 400);
        }

        const input = { name: "CRUD integration " + Date.now(), description: "Temporary test product", price: 19.9, public: "unissex", category: "camisetas", images: ["https://placehold.co/800x1000", "/images/back.jpg"], badge: "Novo", colorName: "Preto", colorValue: "#111111", variants: [{ value: "P", stock: 2 }, { value: "38", stock: 3 }, { value: "Personalizado", stock: 0 }], imageUrl: "test.png" };
        response = await request("", "POST", input);
        assert.equal(response.status, 201);
        const created = await response.json();
        productId = created.id;
        assert.equal(typeof productId, "number");
        assert.equal(created.name, input.name);
        assert.equal(created.price, "19.9");
        assert.deepEqual(values(created.variants), values(input.variants));
        assert.equal(created.description, input.description);
        assert.equal(created.imageUrl, input.imageUrl);
        for (const field of ["public", "category", "images", "badge", "colorName", "colorValue"] as const) {
            assert.deepEqual(created[field], input[field]);
        }
        assert.ok(created.createdAt && created.updatedAt);

        response = await request("");
        assert.equal(response.status, 200);
        const listed = (await response.json()).find((product: { id: number }) => product.id === productId);
        assert.deepEqual(values(listed.variants), values(input.variants));
        for (const field of ["public", "category", "images", "badge", "colorName", "colorValue"] as const) {
            assert.deepEqual(listed[field], input[field]);
        }
        for (const invalid of [
            { public: " " }, { category: "" }, { images: "image.jpg" },
            { images: [123] }, { badge: 1 }, { colorName: false }, { colorValue: 123 }
        ]) {
            assert.equal((await request("", "POST", { ...input, ...invalid })).status, 400);
            assert.equal((await request("/" + productId, "PUT", invalid)).status, 400);
        }
        for (const field of ["public", "category", "images"] as const) {
            const missing = { ...input, [field]: undefined };
            assert.equal((await request("", "POST", missing)).status, 400);
        }

        response = await request("/" + productId, "PUT", {});
        assert.equal(response.status, 400);
        response = await request("/" + productId, "PUT", { variants: [{ value: "P", stock: -1 }] });
        assert.equal(response.status, 400);
        response = await request("/" + productId, "PUT", { variants: [{ value: "P", stock: 7 }, { value: "40", stock: 4 }] });
        assert.equal(response.status, 200);
        const updated = await response.json();
        assert.deepEqual(values(updated.variants), values([{ value: "P", stock: 7 }, { value: "40", stock: 4 }]));
        assert.equal(updated.variants.find((v: { value: string }) => v.value === "P").id, created.variants.find((v: { value: string }) => v.value === "P").id);
        assert.equal(updated.name, input.name);
        assert.equal(updated.price, created.price);

        for (const variants of [
            [{ value: "P", stock: 1 }, { value: " P ", stock: 2 }],
            [{ value: "P", stock: 1.5 }], [{ value: "P", stock: -1 }],
            [{ value: "P", stock: "2" }], [{ value: "P" }],
            [{ value: "P", stock: 2147483648 }], [{ value: " ", stock: 1 }],
            [{ value: 38, stock: 1 }], null
        ]) {
            assert.equal((await request("", "POST", { ...input, variants })).status, 400);
            assert.equal((await request("/" + productId, "PUT", { name: "Must not persist", variants })).status, 400);
        }
        assert.equal((await request("", "POST", { name: "Missing variants", price: 10 })).status, 400);
        response = await request("/" + productId, "PUT", { description: "Updated description" });
        assert.equal(response.status, 200);
        const preserved = await response.json();
        assert.deepEqual(preserved.variants, updated.variants);
        assert.equal(preserved.name, input.name);

        const details = { public: "feminino", category: "jaquetas", images: ["https://placehold.co/600x800"], badge: "Destaque", colorName: "Azul", colorValue: "#224488" };
        response = await request("/" + productId, "PUT", details);
        assert.equal(response.status, 200);
        const withDetails = await response.json();
        for (const field of Object.keys(details) as (keyof typeof details)[]) {
            assert.deepEqual(withDetails[field], details[field]);
        }
        assert.deepEqual(withDetails.variants, preserved.variants);
        response = await request("/" + productId, "PUT", { images: [], badge: null, colorName: null, colorValue: null });
        assert.equal(response.status, 200);
        const cleared = await response.json();
        assert.deepEqual(cleared.images, []);
        for (const field of ["badge", "colorName", "colorValue"]) assert.equal(cleared[field], null);
        assert.equal(cleared.public, details.public);
        assert.equal(cleared.category, details.category);

        response = await request("/" + productId, "PUT", { variants: [] });
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).variants, []);
        assert.equal(await prisma.productVariant.count({ where: { productId } }), 0);
        response = await request("/" + productId, "PUT", { variants: input.variants });
        assert.equal(response.status, 200);
        assert.equal(await prisma.productVariant.count({ where: { productId } }), 3);

        response = await request("/" + productId, "DELETE");
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { message: "Produto exclu\u00eddo com sucesso." });
        assert.equal(await prisma.productVariant.count({ where: { productId } }), 0);
        for (const method of ["PUT", "DELETE"]) {
            response = await request("/" + productId, method, {});
            assert.equal(response.status, 404);
            assert.deepEqual(await response.json(), { error: "Produto n\u00e3o encontrado." });
        }
        response = await request("");
        assert.equal(response.status, 200);
        assert.ok(!(await response.json()).some((product: { id: number }) => product.id === productId));
    } finally {
        try {
            if (productId !== undefined) await prisma.product.deleteMany({ where: { id: productId } });
            await prisma.admin.deleteMany({ where: { email } });
        } finally {
            await Promise.all([
                new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
                prisma.$disconnect()
            ]);
        }
    }
});
