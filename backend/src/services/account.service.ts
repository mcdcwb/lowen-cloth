import type { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { registerUniqueEmail } from "../lib/account-registration.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import type { updateAccountSchema, changePasswordSchema } from "../schemas/account.schema.js";

const select = { id: true, name: true, email: true, address: {
    select: { cep: true, street: true, number: true, complement: true, neighborhood: true, city: true, state: true }
} } as const;
function profile(user: NonNullable<Awaited<ReturnType<typeof getRecord>>>) {
    const { address, ...account } = user;
    return { account: { ...account, role: "USER" as const }, address };
}
const getRecord = (id: number) => prisma.user.findUnique({ where: { id }, select });
export async function getProfile(id: number) {
    const user = await getRecord(id);
    return user ? profile(user) : null;
}
export async function updateProfile(id: number, input: z.infer<typeof updateAccountSchema>) {
    return registerUniqueEmail(input.email, async tx => {
        if (input.address) await tx.userAddress.upsert({ where: { userId: id }, create: { userId: id, ...input.address }, update: input.address });
        else await tx.userAddress.deleteMany({ where: { userId: id } });
        return profile(await tx.user.update({ where: { id }, data: { email: input.email }, select }));
    }, id);
}
export async function changePassword(id: number, input: z.infer<typeof changePasswordSchema>) {
    const user = await prisma.user.findUnique({ where: { id }, select: { passwordHash: true } });
    if (!user || !await verifyPassword(user.passwordHash, input.currentPassword)) return false;
    const passwordHash = await hashPassword(input.newPassword);
    // A concurrent password change must not be overwritten using an obsolete password.
    const updated = await prisma.user.updateMany({ where: { id, passwordHash: user.passwordHash }, data: { passwordHash } });
    return updated.count === 1;
}
