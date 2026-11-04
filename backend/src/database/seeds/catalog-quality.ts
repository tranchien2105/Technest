import { CURATED_PRODUCTS, STOREFRONT_BATCH } from "./storefront-demo-data.js";

export const LEGACY_DATASET = "development-illustration";
export const LEGACY_CUES: Record<string, string> = {
  mechanical: "Gasket Mechanical Keyboard", wireless: "Tri-mode Wireless Keyboard", gaming: "Rapid Trigger Gaming Keyboard",
  compact: "Compact 75 Percent Keyboard", ergonomic: "Split Ergonomic Keyboard", "low-profile": "Low-profile Wireless Keyboard",
  office: "Quiet Office Keyboard", custom: "Hot-swap Custom Keyboard", keycaps: "PBT Double-shot Keycap Set",
  switches: "Linear Mechanical Switch Set", "numeric-keypads": "Wireless Numeric Keypad",
  "gaming-mice": "Lightweight Gaming Mouse", "wireless-mice": "Dual-mode Wireless Mouse", "ergonomic-mice": "Ergonomic Productivity Mouse",
  "silent-mice": "Silent-click Wireless Mouse", "travel-mice": "Compact Travel Mouse", "productivity-mice": "Precision Productivity Mouse",
  "lightweight-mice": "Ultra-light Esports Mouse", trackballs: "Wireless Trackball Mouse", "wired-mice": "Wired Optical Mouse",
  "vertical-mice": "Vertical Ergonomic Mouse", mousepads: "Control Surface Mouse Pad",
  "4k-monitors": "4K UHD Display", "qhd-monitors": "QHD IPS Display", "gaming-monitors": "Adaptive Gaming Display",
  "fhd-monitors": "Full HD IPS Display", "ultrawide-monitors": "Ultra-wide Curved Display", "creator-monitors": "Creator Color Display",
  "portable-monitors": "Portable USB-C Display", "high-refresh-monitors": "High-refresh Gaming Display", "oled-monitors": "OLED HDR Display",
  "monitor-arms": "Adjustable Monitor Arm", "monitor-lights": "Dimmable Monitor Light Bar",
  "gaming-headsets": "Surround Gaming Headset", "wireless-earbuds": "True Wireless Earbuds", "noise-cancelling": "ANC Wireless Headphones",
  "studio-headphones": "Studio Reference Headphones", "desktop-speakers": "Powered Desktop Speakers", microphones: "Broadcast Microphone",
  "usb-microphones": "USB Condenser Microphone", "audio-interfaces": "USB Audio Interface", "headphone-dacs": "Portable Headphone DAC",
  "conference-audio": "Conference Speakerphone", soundbars: "Compact Desktop Soundbar",
  "usb-hubs": "Multiport USB-C Hub", "docking-stations": "Thunderbolt Docking Station", adapters: "USB-C Display Adapter",
  cables: "Braided USB-C Cable", "laptop-stands": "Adjustable Aluminum Laptop Stand", webcams: "Full HD Autofocus Webcam",
  chargers: "GaN USB-C Charger", "desk-accessories": "Modular Desk Organizer", streaming: "Compact Streaming Capture Device",
  controllers: "Wireless PC Controller", storage: "Portable SSD Storage",
};
const finishes = ["Graphite", "Arctic White", "Midnight", "Silver", "Forest Green", "Sandstone"];

export type QualityProduct = {
  id: string; name: string; slug: string; price: string; status: string;
  attributes: Record<string, unknown>; category_slug: string; brand_slug: string; brand_name: string;
};

/** Multiple independent generator identifiers are mandatory. Names/timestamps alone never authorize changes. */
export function isOwnedLegacyIllustration(product: QualityProduct): boolean {
  const attributes = product.attributes;
  const ordinal = attributes.seedOrdinal;
  const cue = LEGACY_CUES[product.category_slug];
  return attributes.dataset === LEGACY_DATASET && typeof ordinal === "number"
    && Number.isInteger(ordinal) && ordinal >= 0 && ordinal < 90 && Boolean(cue)
    && attributes.seedKey === `${product.category_slug}:${ordinal}`
    && product.slug.startsWith("catalog-") && product.slug.endsWith(`-${product.category_slug}`)
    && finishes.some((finish) => product.name === `${product.brand_name} ${cue} ${100 + ordinal} ${finish}`);
}

export function validateCuratedIdentity(product: QualityProduct): string[] {
  if (product.attributes.seedBatch !== STOREFRONT_BATCH) return [];
  const ordinal = product.attributes.seedOrdinal;
  const fixture = typeof ordinal === "number" ? CURATED_PRODUCTS[ordinal] : undefined;
  if (!fixture) return ["curated_unknown_identifier"];
  const issues = [];
  if (product.name !== fixture.name) issues.push("curated_model_mismatch");
  if (product.brand_slug !== fixture.brandSlug) issues.push("curated_brand_mismatch");
  if (product.category_slug !== fixture.categorySlug) issues.push("curated_category_mismatch");
  if (product.attributes.imageType !== fixture.imageKey) issues.push("curated_image_type_mismatch");
  return issues;
}

export function validVndAmount(value: string): boolean {
  return /^\d+$/.test(value) && BigInt(value) > 0n;
}
