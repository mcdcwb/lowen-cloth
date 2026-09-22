import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";
import { seedDevelopmentProducts, seedWhere } from "../src/lib/development-products.js";

try {
    const [database] = await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`;
    if (process.env.NODE_ENV === "production" || database?.name !== "lowen_cloth") {
        throw new Error("Seed permitido apenas em desenvolvimento no banco lowen_cloth.");
    }
    const before = { users: await prisma.user.count(), admins: await prisma.admin.count() };
    const otherProductsBefore = await prisma.product.count({
        where: { OR: [{ description: null }, { NOT: seedWhere }] }
    });
    await seedDevelopmentProducts();
    // Read persisted data after the transaction commits.
    const products = await prisma.product.findMany({ where: seedWhere, include: { colors: { include: { variants: true } } } });
    const countBy = (field: "category" | "public") => products.reduce<Record<string, number>>((counts, product) => {
        counts[product[field]] = (counts[product[field]] ?? 0) + 1;
        return counts;
    }, {});
    console.log(JSON.stringify({
        database: database.name,
        products: products.length,
        variants: products.reduce((sum, product) => sum + product.colors.reduce((n, c) => n + c.variants.length, 0), 0),
        categories: countBy("category"),
        publics: countBy("public"),
        accountsBefore: before,
        accountsAfter: { users: await prisma.user.count(), admins: await prisma.admin.count() },
        otherProductsBefore,
        otherProductsAfter: await prisma.product.count({
            where: { OR: [{ description: null }, { NOT: seedWhere }] }
        })
    }, null, 2));
} catch (error) {
    console.error(error instanceof Error ? error.message : "Falha ao executar seed.");
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
