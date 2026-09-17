import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { createAdminSchema } from "../schemas/admin.schema.js";
import { createAdmin } from "../services/admin.service.js";

try {
    const input = createAdminSchema.safeParse({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD
    });
    if (!input.success) {
        console.error("Defina ADMIN_EMAIL válido e ADMIN_PASSWORD com 5 a 128 caracteres.");
        process.exitCode = 1;
    } else {
        const admin = await createAdmin(input.data);
        console.log("Administrador criado: " + admin.email);
    }
} catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
        console.error("Já existe um administrador com este e-mail.");
    } else {
        console.error("Não foi possível criar o administrador. Verifique a conexão e as migrations.");
    }
    process.exitCode = 1;
} finally {
    await prisma.$disconnect();
}
