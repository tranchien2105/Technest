export const STOREFRONT_BATCH = "tn-curated-20261102";

export const ROOTS = ["monitors", "keyboards", "mice", "audio", "accessories"] as const;
export type StorefrontRoot = (typeof ROOTS)[number];
export const CURATED_BRANDS = [{ name: "ELGATO", slug: "elgato" }] as const;

type CuratedProduct = {
  name: string;
  brandSlug: string;
  categorySlug: string;
  price: number;
  imageKey: string;
  sourceUrl?: string;
};

// Model names are curated product identifiers. No unverified specifications are asserted.
// Prices, inventory and category illustrations are development data, not current offers.
export const CURATED_PRODUCTS: CuratedProduct[] = [
  { name: "Dell UltraSharp U3223QE", brandSlug: "dell", categorySlug: "monitors", price: 15990000, imageKey: "monitor" },
  { name: "Dell UltraSharp U2724D", brandSlug: "dell", categorySlug: "monitors", price: 10490000, imageKey: "monitor" },
  { name: "Samsung Odyssey G7 32", brandSlug: "samsung", categorySlug: "monitors", price: 12990000, imageKey: "monitor" },
  { name: "Samsung Odyssey G6 27", brandSlug: "samsung", categorySlug: "monitors", price: 11990000, imageKey: "monitor" },
  { name: "LG UltraGear 32GS95UE", brandSlug: "lg", categorySlug: "monitors", price: 29990000, imageKey: "monitor" },
  { name: "LG UltraGear 27GR95QE", brandSlug: "lg", categorySlug: "monitors", price: 17990000, imageKey: "monitor" },
  { name: "ASUS ROG Swift OLED PG27AQDM", brandSlug: "asus", categorySlug: "monitors", price: 21990000, imageKey: "monitor" },
  { name: "ASUS ROG Swift PG32UCDM", brandSlug: "asus", categorySlug: "monitors", price: 32990000, imageKey: "monitor" },
  { name: "BenQ PD2705U", brandSlug: "benq", categorySlug: "monitors", price: 11990000, imageKey: "monitor" },
  { name: "GIGABYTE M27Q", brandSlug: "gigabyte", categorySlug: "monitors", price: 7990000, imageKey: "monitor" },
  { name: "Acer Nitro XV272U", brandSlug: "acer", categorySlug: "monitors", price: 6990000, imageKey: "monitor" },
  { name: "Lenovo ThinkVision P27h-30", brandSlug: "lenovo", categorySlug: "monitors", price: 10990000, imageKey: "monitor" },

  { name: "Logitech G Pro X TKL LIGHTSPEED", brandSlug: "logitech", categorySlug: "keyboards", price: 4990000, imageKey: "keyboard" },
  { name: "Logitech MX Keys S", brandSlug: "logitech", categorySlug: "keyboards", price: 2790000, imageKey: "keyboard" },
  { name: "Keychron V1 Max", brandSlug: "keychron", categorySlug: "keyboards", price: 3690000, imageKey: "keyboard" },
  { name: "Keychron Q3 Max", brandSlug: "keychron", categorySlug: "keyboards", price: 5990000, imageKey: "keyboard" },
  { name: "Razer Huntsman V3 Pro TKL", brandSlug: "razer", categorySlug: "keyboards", price: 5990000, imageKey: "keyboard" },
  { name: "SteelSeries Apex 7", brandSlug: "steelseries", categorySlug: "keyboards", price: 3990000, imageKey: "keyboard" },
  { name: "Corsair K70 RGB Pro", brandSlug: "corsair", categorySlug: "keyboards", price: 4990000, imageKey: "keyboard" },
  { name: "Microsoft Designer Compact Keyboard", brandSlug: "microsoft", categorySlug: "keyboards", price: 2190000, imageKey: "keyboard" },
  { name: "ASUS ROG Strix Scope II 96 Wireless", brandSlug: "asus", categorySlug: "keyboards", price: 4990000, imageKey: "keyboard" },
  { name: "HyperX Alloy Origins Core", brandSlug: "hyperx", categorySlug: "keyboards", price: 2490000, imageKey: "keyboard" },
  { name: "Cooler Master CK720", brandSlug: "cooler-master", categorySlug: "keyboards", price: 2790000, imageKey: "keyboard" },
  { name: "Logitech G915 X", brandSlug: "logitech", categorySlug: "keyboards", price: 5290000, imageKey: "keyboard", sourceUrl: "https://www-gaming.logitech.com/en-us/shop/p/g915-x-wireless-mechanical-gaming-keyboard" },

  { name: "Logitech G502 X Plus", brandSlug: "logitech", categorySlug: "mice", price: 3990000, imageKey: "mouse" },
  { name: "Logitech MX Anywhere 3S", brandSlug: "logitech", categorySlug: "mice", price: 1890000, imageKey: "mouse" },
  { name: "Logitech G502 X Lightspeed", brandSlug: "logitech", categorySlug: "mice", price: 3290000, imageKey: "mouse" },
  { name: "Logitech G Pro X Superlight 2", brandSlug: "logitech", categorySlug: "mice", price: 3990000, imageKey: "mouse" },
  { name: "Razer Viper V3 Pro", brandSlug: "razer", categorySlug: "mice", price: 3990000, imageKey: "mouse" },
  { name: "Razer Basilisk V3 Pro", brandSlug: "razer", categorySlug: "mice", price: 3990000, imageKey: "mouse" },
  { name: "SteelSeries Rival 5", brandSlug: "steelseries", categorySlug: "mice", price: 2190000, imageKey: "mouse" },
  { name: "ASUS ROG Harpe Ace Aim Lab Edition", brandSlug: "asus", categorySlug: "mice", price: 3990000, imageKey: "mouse" },
  { name: "Corsair M75 Air Wireless", brandSlug: "corsair", categorySlug: "mice", price: 3290000, imageKey: "mouse" },
  { name: "Microsoft Surface Precision Mouse", brandSlug: "microsoft", categorySlug: "mice", price: 2190000, imageKey: "mouse" },
  { name: "HyperX Pulsefire Haste 2 Wireless", brandSlug: "hyperx", categorySlug: "mice", price: 2490000, imageKey: "mouse" },
  { name: "ZOWIE EC2-CW", brandSlug: "zowie", categorySlug: "mice", price: 3990000, imageKey: "mouse" },

  { name: "Sony INZONE H9", brandSlug: "sony", categorySlug: "gaming-headsets", price: 6990000, imageKey: "audio" },
  { name: "Sony WF-1000XM5", brandSlug: "sony", categorySlug: "wireless-earbuds", price: 5990000, imageKey: "earbuds", sourceUrl: "https://www.sony.com/electronics/support/wireless-headphones-bluetooth-headphones/wf-1000xm5/specifications" },
  { name: "Sony WH-CH720N", brandSlug: "sony", categorySlug: "audio", price: 2990000, imageKey: "audio" },
  { name: "JBL Live 770NC", brandSlug: "jbl", categorySlug: "audio", price: 3990000, imageKey: "audio" },
  { name: "JBL Flip 6", brandSlug: "jbl", categorySlug: "audio", price: 2490000, imageKey: "speaker" },
  { name: "Bose QuietComfort Ultra Earbuds", brandSlug: "bose", categorySlug: "wireless-earbuds", price: 7990000, imageKey: "earbuds" },
  { name: "Sennheiser HD 560S", brandSlug: "sennheiser", categorySlug: "studio-headphones", price: 4290000, imageKey: "audio" },
  { name: "Audio-Technica ATH-SQ1TW", brandSlug: "audio-technica", categorySlug: "wireless-earbuds", price: 1990000, imageKey: "earbuds" },
  { name: "Marshall Major V", brandSlug: "marshall", categorySlug: "audio", price: 3990000, imageKey: "audio" },
  { name: "HyperX Cloud Alpha Wireless", brandSlug: "hyperx", categorySlug: "gaming-headsets", price: 4990000, imageKey: "audio" },
  { name: "Logitech Zone Vibe Wireless", brandSlug: "logitech", categorySlug: "conference-audio", price: 3290000, imageKey: "audio" },
  { name: "Shure MV7+", brandSlug: "shure", categorySlug: "microphones", price: 7990000, imageKey: "microphone" },

  { name: "Anker 555 USB-C Hub", brandSlug: "anker", categorySlug: "usb-hubs", price: 2190000, imageKey: "hub" },
  { name: "Anker 737 Power Bank", brandSlug: "anker", categorySlug: "accessories", price: 3290000, imageKey: "charger" },
  { name: "UGREEN Revodok Pro 109", brandSlug: "ugreen", categorySlug: "usb-hubs", price: 2190000, imageKey: "hub" },
  { name: "Baseus Metal Gleam Series Hub", brandSlug: "baseus", categorySlug: "usb-hubs", price: 1290000, imageKey: "hub" },
  { name: "TP-Link Archer AX55", brandSlug: "tp-link", categorySlug: "accessories", price: 2490000, imageKey: "network" },
  { name: "TP-Link Deco X50", brandSlug: "tp-link", categorySlug: "accessories", price: 3290000, imageKey: "network" },
  { name: "Samsung T7 Shield Portable SSD", brandSlug: "samsung", categorySlug: "storage", price: 2990000, imageKey: "storage", sourceUrl: "https://news.samsung.com/us/samsungs-t7-shield-rugged-portable-ssd-durability-fast-sustained-performance-professionals-consumers-on-the-go/" },
  { name: "SanDisk Extreme Portable SSD", brandSlug: "sandisk", categorySlug: "storage", price: 2490000, imageKey: "storage" },
  { name: "Kingston XS1000 External SSD", brandSlug: "kingston", categorySlug: "storage", price: 1890000, imageKey: "storage", sourceUrl: "https://www.kingston.com/en/external-ssd/xs1000-external-solid-state-drive" },
  { name: "Logitech MX Brio", brandSlug: "logitech", categorySlug: "webcams", price: 5990000, imageKey: "webcam" },
  { name: "Elgato Stream Deck MK.2", brandSlug: "elgato", categorySlug: "streaming", price: 3990000, imageKey: "streaming", sourceUrl: "https://help.elgato.com/hc/en-us/articles/18208816152333-Elgato-Stream-Deck-MK-2-Technical-Specifications" },
  { name: "Apple USB-C Digital AV Multiport Adapter", brandSlug: "apple", categorySlug: "adapters", price: 2190000, imageKey: "adapter" },
];

export const ROOT_BRANDS: Record<StorefrontRoot, string[]> = {
  monitors: ["dell", "samsung", "lg", "asus", "benq", "gigabyte", "acer", "lenovo"],
  keyboards: ["logitech", "keychron", "razer", "steelseries", "corsair", "microsoft", "asus", "hyperx", "cooler-master"],
  mice: ["logitech", "razer", "steelseries", "asus", "corsair", "microsoft", "hyperx", "zowie"],
  audio: ["sony", "jbl", "bose", "sennheiser", "audio-technica", "marshall", "hyperx", "logitech", "shure"],
  accessories: ["anker", "ugreen", "baseus", "tp-link", "samsung", "sandisk", "kingston", "logitech", "corsair", "apple", "elgato"],
};

const categoryRoot: Record<string, StorefrontRoot> = {
  monitors: "monitors", keyboards: "keyboards", mice: "mice", audio: "audio",
  "wireless-earbuds": "audio", "desktop-speakers": "audio", "gaming-headsets": "audio", "studio-headphones": "audio",
  "conference-audio": "audio", microphones: "audio", "usb-hubs": "accessories", accessories: "accessories",
  storage: "accessories", webcams: "accessories", streaming: "accessories", adapters: "accessories",
};

export function storefrontFixture(index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= CURATED_PRODUCTS.length) throw new Error("Invalid curated fixture index");
  const source = CURATED_PRODUCTS[index]!;
  const root = categoryRoot[source.categorySlug];
  if (!root) throw new Error(`Unmapped curated category ${source.categorySlug}`);
  const slug = source.name.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const sku = `TNQ26-${String(index + 1).padStart(3, "0")}-STD`;
  return {
    ...source,
    ordinal: index,
    root,
    slug: `${STOREFRONT_BATCH}-${slug}`,
    description: `${source.name} là model thuộc danh mục ${source.categorySlug}. Ảnh là hình minh họa theo nhóm sản phẩm; giá và tồn kho chỉ phục vụ môi trường phát triển, không phải báo giá thương mại hiện hành.${source.sourceUrl ? ` Tham khảo tên model từ trang nhà sản xuất: ${source.sourceUrl}` : ""}`,
    sku,
    image: `/images/storefront-curated/${source.imageKey}.svg`,
    attributes: { dataset: "curated-development-catalog", seedBatch: STOREFRONT_BATCH, seedOrdinal: index, imageType: source.imageKey, priceIsIllustrative: true, ...(source.sourceUrl ? { modelSource: source.sourceUrl } : {}) },
  };
}
