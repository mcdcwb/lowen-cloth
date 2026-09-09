import { createProductSchema } from "./schemas/product.schema.js";
import "dotenv/config";
import express from "express";
import { prisma } from "./lib/prisma.js";

const app = express();

const PORT = 3000;

app.use(express.json());

app.get("/", async (req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        res.send("API do Löwen funcionando e conectada ao PostgreSQL!");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao conectar ao banco de dados.");
    }
});

app.get("/produtos", async (req, res) => {
    try {
        const products = await prisma.product.findMany();

        res.json(products);
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: "Erro ao buscar produtos."
        });
    }
});

app.post("/produtos", async (req, res) => {
    try {
        const result = createProductSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Dados inválidos.",
                errors: result.error.issues
            });
        }

        const product = await prisma.product.create({
            data: result.data
        });

        res.status(201).json(product);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao criar produto."
        });
    }
});

app.put("/produtos/:id", async (req, res) => {
    try {
        const id = Number(req.params.id);

        const result = createProductSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                error: "Dados inválidos.",
                errors: result.error.issues
            });
        }

        const product = await prisma.product.update({
            where: {
                id
            },
            data: result.data
        });

        res.json(product);
    } catch (error) {
        console.error(error);

        res.status(500).json({
            error: "Erro ao atualizar produto."
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});