import { lookup } from "node:dns";
import { readFile, realpath, stat } from "node:fs/promises";
import { get } from "node:https";
import { BlockList, isIP } from "node:net";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import type { Env } from "../../config/env.js";
import type { OrderEmailPayload } from "./order-email.types.js";

const MAX_BYTES = 5 * 1024 * 1024;
const privateAddresses = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) privateAddresses.addSubnet(address, prefix, "ipv4");

export const isPublicImageAddress = (address: string) =>
  isIP(address) === 4 && !privateAddresses.check(address, "ipv4");

function remoteImage(url: URL, redirects = 0): Promise<Buffer> {
  if (url.protocol !== "https:" || url.username || url.password ||
    (url.port && url.port !== "443") || url.hostname.includes(":") ||
    (isIP(url.hostname) && !isPublicImageAddress(url.hostname)))
    return Promise.reject(new Error("Unsupported email image URL"));
  return new Promise((done, reject) => {
    const request = get(url, {
      family: 4,
      // Pin the connection to the address we checked, including on every redirect.
      lookup(hostname, _options, callback) {
        lookup(hostname, { family: 4 }, (error, address, family) => {
          if (error) callback(error, "", 4);
          else if (!isPublicImageAddress(address)) callback(new Error("Private email image address"), "", 4);
          else callback(null, address, family);
        });
      },
      headers: { Accept: "image/png,image/jpeg,image/webp,image/*;q=0.8" },
    }, (response) => {
      if (response.statusCode && [301, 302, 303, 307, 308].includes(response.statusCode)) {
        response.resume();
        if (!response.headers.location || redirects >= 2) reject(new Error("Email image redirect limit"));
        else {
          try { done(remoteImage(new URL(response.headers.location, url), redirects + 1)); }
          catch (error) { reject(error); }
        }
        return;
      }
      if (response.statusCode !== 200 || !response.headers["content-type"]?.startsWith("image/")) {
        response.resume();
        reject(new Error("Email image unavailable"));
        return;
      }
      const chunks: Buffer[] = [];
      let size = 0;
      response.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) request.destroy(new Error("Email image too large"));
        else chunks.push(chunk);
      });
      response.on("end", () => done(Buffer.concat(chunks)));
      response.on("error", reject);
    });
    const timeout = setTimeout(() => request.destroy(new Error("Email image timeout")), 5000);
    timeout.unref();
    request.on("close", () => clearTimeout(timeout));
    request.on("error", reject);
  });
}

export async function loadOrderEmailImage(source: string, env: Env): Promise<Buffer> {
  const url = new URL(source, env.FRONTEND_URL);
  let image: Buffer | undefined;
  if (url.origin === new URL(env.FRONTEND_URL).origin && url.pathname.startsWith("/images/")) {
    const pathname = decodeURIComponent(url.pathname);
    const roots = [fileURLToPath(new URL("../../../../public/", import.meta.url)), env.STOREFRONT_DIST];
    for (const root of roots) {
      if (!root) continue;
      try {
        const directory = await realpath(root);
        const filename = await realpath(resolve(directory, `.${pathname}`));
        if (!filename.startsWith(directory + sep) || (await stat(filename)).size > MAX_BYTES) continue;
        image = await readFile(filename);
        break;
      } catch { /* Try the production storefront directory after uploaded images. */ }
    }
    if (!image) throw new Error("Local email image unavailable");
  } else image = await remoteImage(url);

  // PNG works in mail clients for JPEG/WebP/AVIF uploads and shipped SVG illustrations.
  return sharp(image, { limitInputPixels: 25_000_000, animated: false })
    .rotate().resize(144, 144, { fit: "contain", background: "#ffffff" })
    .png().toBuffer();
}

export interface InlineEmailImage {
  filename: string;
  content: Buffer;
  contentType: "image/png";
  contentDisposition: "inline";
  cid: string;
}

export async function embedOrderEmailImages(
  payload: OrderEmailPayload,
  env: Env,
  loadImage = loadOrderEmailImage,
) {
  const images = new Map<string, Promise<InlineEmailImage | undefined>>();
  const items: OrderEmailPayload["items"] = [];
  // Bound simultaneous fetches/decodes, and reuse attachments for repeated variants.
  for (let offset = 0; offset < payload.items.length; offset += 3) {
    items.push(...await Promise.all(payload.items.slice(offset, offset + 3).map(async (item) => {
      const { imageUrl, ...details } = item;
      if (!imageUrl) return details;
      if (!images.has(imageUrl)) {
        const cid = `product-${images.size}@technest`;
        images.set(imageUrl, loadImage(imageUrl, env).then((content): InlineEmailImage => ({
          filename: `${cid.split("@")[0]}.png`, content, contentType: "image/png", contentDisposition: "inline", cid,
        })).catch(() => undefined));
      }
      const image = await images.get(imageUrl);
      return { ...details, ...(image ? { imageUrl: `cid:${image.cid}` } : {}) };
    })));
  }
  const attachments = (await Promise.all(images.values())).filter((image): image is InlineEmailImage => !!image);
  return { payload: { ...payload, items }, attachments };
}
