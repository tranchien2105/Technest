import { randomUUID } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import multer from "multer";
import sharp from "sharp";
import { AppError } from "../../shared/errors.js";
export const uploadDirectory = fileURLToPath(
  new URL("../../../../public/images/uploads/", import.meta.url),
);
export const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 10, fields: 10 },
}).array("images", 10);
export const spreadsheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 5 },
}).single("file");
export async function saveImages(files: Express.Multer.File[]) {
  if (!files.length)
    throw new AppError(400, "IMAGE_REQUIRED", "Chọn ít nhất một ảnh JPEG, PNG, WebP hoặc AVIF.");
  const saved: string[] = [];
  await mkdir(uploadDirectory, { recursive: true });
  try {
    const result = [];
    for (const file of files) {
      const pipeline = sharp(file.buffer, { limitInputPixels: 25000000, animated: false });
      const metadata = await pipeline.metadata().catch(() => null);
      if (!metadata || !["jpeg", "png", "webp", "avif", "heif"].includes(metadata.format || ""))
        throw new AppError(400, "INVALID_IMAGE", "Định dạng ảnh không được hỗ trợ.");
      const filename = `${randomUUID()}.webp`,
        path = `${uploadDirectory}${filename}`;
      await pipeline
        .rotate()
        .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(path);
      saved.push(path);
      result.push({
        url: `/images/uploads/${filename}`,
        altText: file.originalname.replace(/\.[^.]*$/, "").slice(0, 220),
      });
    }
    return result;
  } catch (error) {
    await Promise.allSettled(saved.map((path) => unlink(path)));
    throw error;
  }
}
