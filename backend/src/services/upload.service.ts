import { randomUUID } from "node:crypto";
import { getCloudinary } from "../config/cloudinary.js";

export const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PRODUCT_IMAGE_FOLDER = "lowen-cloth/products";
export type ProductImageUploader = (buffer: Buffer) => Promise<string>;

// Check actual bytes as well as the client MIME. Cloudinary then decodes the image
// and enforces allowed_formats; extension/original filename is never trusted.
export function imageMime(buffer: Buffer): string | null {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
    if (buffer.length >= 16 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP" &&
        ["VP8 ", "VP8L", "VP8X"].includes(buffer.toString("ascii", 12, 16))) return "image/webp";
    return null;
}
export function isCloudinaryImageUrl(value: unknown): value is string {
    if (typeof value !== "string") return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.username && !url.password && !url.port &&
            /^\/[^/]+\/image\/upload\//.test(url.pathname) && !url.search && !url.hash;
    } catch { return false; }
}
export const uploadProductImage: ProductImageUploader = async buffer => {
    const client = getCloudinary();
    return new Promise<string>((resolve, reject) => {
        const failed = () => reject(new Error("Não foi possível enviar a imagem. Tente novamente."));
        try {
            const stream = client.uploader.upload_stream({
                resource_type: "image", folder: PRODUCT_IMAGE_FOLDER, public_id: randomUUID(),
                overwrite: false, allowed_formats: ["jpg", "png", "webp"], timeout: 60000
            }, (error, result) => {
                if (error || !isCloudinaryImageUrl(result?.secure_url)) return failed();
                resolve(result.secure_url);
            });
            stream.on("error", failed);
            stream.end(buffer);
        } catch { failed(); }
    });
};
