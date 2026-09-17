import { createUser } from "../services/user.service.js";
import type { Request, Response } from "express";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";

export async function login(req: Request, res: Response) {
    res.setHeader("Cache-Control", "no-store");
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
        return res.status(400).json({ error: "Dados inválidos.", errors: result.error.issues });
    }
    try {
        const session = await authService.login(result.data);
        if (!session) return res.status(401).json({ error: "E-mail ou senha inválidos." });
        return res.json(session);
    } catch {
        return res.status(500).json({ error: "Erro ao autenticar conta." });
    }
}

export function me(req: Request, res: Response) {
    return res.json({
        account: res.locals.account,
        ...(res.locals.admin ? { admin: res.locals.admin } : {})
    });
}

export async function register(req: Request, res: Response) {
    res.setHeader("Cache-Control", "no-store");
    const result = registerSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Dados inválidos.", errors: result.error.issues });
    try {
        const user = await createUser(result.data);
        return res.status(201).json({ account: { ...user, role: "USER" } });
    } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
            return res.status(409).json({ error: "E-mail já cadastrado." });
        }
        return res.status(500).json({ error: "Erro ao criar conta." });
    }
}
