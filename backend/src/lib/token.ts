import { SignJWT, jwtVerify } from "jose";
import { getJwtKey } from "../config/auth.js";
import type { AccountRole, TokenIdentity } from "../types/auth.js";

const issuer = "lowen-cloth";
const audiences = { ADMIN: "lowen-cloth-admin", USER: "lowen-cloth-user" } as const;
export const tokenLifetimeSeconds = 15 * 60;

export function signAccountToken(id: number, role: AccountRole) {
    return new SignJWT({ role })
        .setProtectedHeader({ alg: "HS256", typ: "JWT" })
        .setSubject(String(id))
        .setIssuer(issuer)
        .setAudience(audiences[role])
        .setIssuedAt()
        .setExpirationTime("15m")
        .sign(getJwtKey());
}

export function signAdminToken(adminId: number) {
    return signAccountToken(adminId, "ADMIN");
}

export async function verifyAccountToken(token: string): Promise<TokenIdentity> {
    const { payload } = await jwtVerify(token, getJwtKey(), {
        algorithms: ["HS256"],
        issuer,
        audience: Object.values(audiences),
        requiredClaims: ["sub", "iat", "exp"],
        maxTokenAge: "15m"
    });
    const id = Number(payload.sub);
    if (!/^[1-9]\d*$/.test(payload.sub ?? "") || !Number.isSafeInteger(id) || id > 2147483647) {
        throw new Error("Token inválido.");
    }

    // Legacy tokens may omit role only for the original administrative audience.
    if (payload.aud === audiences.ADMIN && (payload.role === "ADMIN" || payload.role === undefined)) {
        return { id, role: "ADMIN" };
    }
    if (payload.aud === audiences.USER && payload.role === "USER") return { id, role: "USER" };
    throw new Error("Token inválido.");
}

export async function verifyAdminToken(token: string) {
    const identity = await verifyAccountToken(token);
    if (identity.role !== "ADMIN") throw new Error("Token administrativo necessário.");
    return identity.id;
}
