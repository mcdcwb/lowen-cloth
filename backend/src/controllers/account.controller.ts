import type { Request, Response } from "express";
import { updateAccountSchema, changePasswordSchema } from "../schemas/account.schema.js";
import * as service from "../services/account.service.js";
import { EmailInUseError } from "../lib/account-registration.js";

export async function getProfile(_req: Request, res: Response) {
    try {
        const profile = await service.getProfile(res.locals.account.id);
        return profile ? res.json(profile) : res.status(404).json({ error: "Conta não encontrada." });
    } catch { return res.status(500).json({ error: "Não foi possível carregar sua conta." }); }
}
export async function updateProfile(req: Request, res: Response) {
    const result = updateAccountSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "Verifique o e-mail e preencha o endereço completo ou deixe-o vazio." });
    try { return res.json(await service.updateProfile(res.locals.account.id, result.data)); }
    catch (error) {
        if (error instanceof EmailInUseError) return res.status(409).json({ error: "E-mail já utilizado." });
        return res.status(500).json({ error: "Não foi possível salvar sua conta." });
    }
}
export async function changePassword(req: Request, res: Response) {
    const result = changePasswordSchema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: "A nova senha deve ter de 5 a 128 caracteres e a confirmação deve ser igual." });
    try {
        if (!await service.changePassword(res.locals.account.id, result.data)) return res.status(400).json({ error: "Senha atual incorreta." });
        return res.json({ message: "Senha alterada com sucesso." });
    } catch { return res.status(500).json({ error: "Não foi possível alterar sua senha." }); }
}
