import "dotenv/config";
import express from "express";
import { getJwtKey } from "./config/auth.js";
import { createAuthRoutes } from "./routes/auth.routes.js";
import { prisma } from "./lib/prisma.js";
import productRoutes from "./routes/product.routes.js";
import shoppingRoutes from "./routes/shopping.routes.js";
import accountRoutes from "./routes/account.routes.js";
import { createUploadRoutes } from "./routes/upload.routes.js";
import type { ProductImageUploader } from "./services/upload.service.js";

export function createApp(options: { uploadProductImage?: ProductImageUploader } = {}) {
    getJwtKey();
    const app = express();

    app.use(express.json());
    app.use("/produtos", productRoutes);
    app.use("/uploads", createUploadRoutes(options.uploadProductImage));
    app.use("/auth", createAuthRoutes());
    app.use("/conta", accountRoutes);
    app.use(shoppingRoutes);

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
