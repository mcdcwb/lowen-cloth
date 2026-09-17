import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "../src/lib/prisma.js";
import { seedDevelopmentProducts, seedWhere } from "../src/lib/development-products.js";

test("repeating the development seed replaces only its own products and variants", async () => {
    const unrelated = await prisma.product.create({
        data: {
            name: "Seed preservation test", price: 10, public: "unissex",
            category: "camisetas", images: [], description: null,
            variants: { create: [{ value: "Livre", stock: 7 }] }
        },
        include: { variants: true }
    });
    try {
        const first = await seedDevelopmentProducts();
        const oldIds = first.map(product => product.id);
        await seedDevelopmentProducts();
        const persisted = await prisma.product.findMany({ where: seedWhere, include: { variants: true } });
        assert.equal(persisted.length, 12);
        assert.equal(persisted.reduce((sum, product) => sum + product.variants.length, 0), 50);
        assert.equal(await prisma.productVariant.count({ where: { productId: { in: oldIds } } }), 0);
        assert.deepEqual(await prisma.product.findUnique({
            where: { id: unrelated.id }, include: { variants: true }
        }), unrelated);
    } finally {
        await prisma.product.delete({ where: { id: unrelated.id } });
        await prisma.$disconnect();
    }
});
