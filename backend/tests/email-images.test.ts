import { mkdtemp, mkdir, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { parseEnv } from "../src/config/env.js";
import { embedOrderEmailImages, isPublicImageAddress, loadOrderEmailImage } from "../src/modules/email/order-email.images.js";
import type { OrderEmailPayload } from "../src/modules/email/order-email.types.js";

const env = parseEnv({
  NODE_ENV: "test", AUTH_JWT_SECRET: "test-secret-with-at-least-32-characters",
  DATABASE_URL: "postgres://test:test@localhost/test", REDIS_URL: "redis://localhost:6379",
  FRONTEND_URL: "http://localhost:5173",
});
const payload: OrderEmailPayload = {
  orderNumber: "TN-IMAGE-TEST", createdAt: "2026-11-06T03:19:57.000Z",
  items: [{ name: "Bàn phím", sku: "KEY-1", imageUrl: "/images/keyboard.svg", quantity: 1, unitPrice: "100000" }],
  subtotal: "100000", shipping: "0", discount: "0", total: "100000",
  shippingAddress: { recipient: "Khách hàng", phone: "0900000000", line1: "Địa chỉ", city: "TP.HCM" },
};
const directories: string[] = [];
afterEach(async () => { await Promise.all(directories.splice(0).map(path => rm(path, { recursive: true, force: true }))); });

describe("inline order email images", () => {
  it("embeds one PNG attachment per image and reuses its CID for repeated variants", async () => {
    const content = Buffer.from("png-fixture");
    const load = vi.fn().mockResolvedValue(content);
    const item = payload.items[0]!;
    const result = await embedOrderEmailImages({ ...payload, items: [item, { ...item, sku: "KEY-2" }] }, env, load);
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.attachments).toEqual([expect.objectContaining({ content, contentType: "image/png", contentDisposition: "inline" })]);
    expect(result.payload.items.map(i => i.imageUrl)).toEqual(["cid:product-0@technest", "cid:product-0@technest"]);
    expect(payload.items[0]?.imageUrl).toBe("/images/keyboard.svg");
  });

  it("omits a failed image so the template shows its fallback while preserving order details", async () => {
    const result = await embedOrderEmailImages(payload, env, vi.fn().mockRejectedValue(new Error("Image unavailable")));
    expect(result.attachments).toEqual([]);
    expect(result.payload.items[0]).not.toHaveProperty("imageUrl");
    expect(result.payload.items[0]?.name).toBe("Bàn phím");
    expect(result.payload.total).toBe(payload.total);
  });

  it("converts a local SVG from the production storefront directory into email-safe PNG", async () => {
    const directory = await mkdtemp(join(tmpdir(), "technest-email-image-"));
    directories.push(directory);
    await mkdir(join(directory, "images"));
    await writeFile(join(directory, "images", "keyboard.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect width="200" height="100" fill="#ff5a00"/></svg>');
    const image = await loadOrderEmailImage("/images/keyboard.svg", { ...env, STOREFRONT_DIST: directory });
    expect(await sharp(image).metadata()).toEqual(expect.objectContaining({ format: "png", width: 144, height: 144 }));
  });

  it("does not read symlinks outside the public image directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "technest-email-image-"));
    directories.push(directory);
    await mkdir(join(directory, "public", "images"), { recursive: true });
    await writeFile(join(directory, "private.svg"), '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    await symlink(join(directory, "private.svg"), join(directory, "public", "images", "private.svg"));
    await expect(loadOrderEmailImage("/images/private.svg", { ...env, STOREFRONT_DIST: join(directory, "public") })).rejects.toThrow("Local email image unavailable");
  });

  it.each(["127.0.0.1", "10.0.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "0.0.0.0", "::1", "::ffff:127.0.0.1"])("blocks private/reserved remote address %s", address => {
    expect(isPublicImageAddress(address)).toBe(false);
  });
  it("allows a public IPv4 address", () => { expect(isPublicImageAddress("8.8.8.8")).toBe(true); });
  it.each(["https://127.0.0.1/private.png", "https://[::1]/private.png", "http://images.example.com/image.png", "https://user:password@images.example.com/image.png"])("rejects unsafe image URL %s before connecting", async source => {
    await expect(loadOrderEmailImage(source, env)).rejects.toThrow("Unsupported email image URL");
  });
});
