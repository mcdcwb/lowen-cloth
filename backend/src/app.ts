import "dotenv/config";
import express from "express";
import { getJwtKey } from "./config/auth.js";
import { createAuthRoutes } from "./routes/auth.routes.js";
import { prisma } from "./lib/prisma.js";
import productRoutes from "./routes/product.routes.js";

export function createApp() {
    getJwtKey();
    const app = express();

    app.use(express.json());
    app.use("/produtos", productRoutes);
    app.use("/auth", createAuthRoutes());

    app.get("/", async (req, res) => {
        try {
            await prisma.$queryRaw`SELECT 1`;

            res.send("API do Löwen funcionando e conectada ao PostgreSQL!");
        } catch (error) {
            console.error(error);
            res.status(500).send("Erro ao conectar ao banco de dados.");
        }
    });

    return app;
}
