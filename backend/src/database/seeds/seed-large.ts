import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import argon2 from "argon2";
import { eq, inArray, isNull, sql } from "drizzle-orm";
import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";
import {
  brands,
  categories,
  inventories,
  inventoryMovements,
  inventoryReservations,
  orderInventoryReservations,
  orderItems,
  orders,
  orderStatusHistory,
  productImages,
  products,
  productVariants,
  userAddresses,
  users,
} from "../schema/index.js";

const env = loadEnv();
const database = new URL(env.DATABASE_URL);
if (env.NODE_ENV !== "development" || database.pathname !== "/technest_dev") {
  throw new Error("Large demo seed is restricted to NODE_ENV=development and technest_dev");
}
// This legacy load fixture invents real-brand model names/specifications. Keep it
// opt-in so a routine seed cannot reactivate quarantined storefront merchandise.
if (!process.argv.includes("--allow-synthetic-fixtures")) {
  throw new Error("Legacy synthetic catalog is disabled by default. Use db:seed:storefront for curated model fixtures. --allow-synthetic-fixtures is only for an isolated development load-test database.");
}
const { db, pool } = createDatabase(env.DATABASE_URL, {
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 32000,
});

const rootCategories = [
  { slug: "keyboards", name: "Bàn phím", nameEn: "Keyboards" },
  { slug: "mice", name: "Chuột", nameEn: "Mice" },
  { slug: "monitors", name: "Màn hình", nameEn: "Monitors" },
  { slug: "audio", name: "Tai nghe & âm thanh", nameEn: "Audio" },
  { slug: "accessories", name: "Phụ kiện", nameEn: "Accessories" },
];

const subcategories = [
  [
    ["mechanical", "Bàn phím cơ", "Mechanical keyboards"],
    ["wireless", "Bàn phím không dây", "Wireless keyboards"],
    ["gaming", "Bàn phím gaming", "Gaming keyboards"],
    ["compact", "Bàn phím nhỏ gọn", "Compact keyboards"],
    ["ergonomic", "Bàn phím công thái học", "Ergonomic keyboards"],
    ["low-profile", "Bàn phím low-profile", "Low-profile keyboards"],
    ["office", "Bàn phím văn phòng", "Office keyboards"],
    ["custom", "Bàn phím custom", "Custom keyboards"],
    ["keycaps", "Keycap", "Keycaps"],
    ["switches", "Switch bàn phím", "Keyboard switches"],
    ["numeric-keypads", "Bàn phím số", "Numeric keypads"],
  ],
  [
    ["gaming-mice", "Chuột gaming", "Gaming mice"],
    ["wireless-mice", "Chuột không dây", "Wireless mice"],
    ["ergonomic-mice", "Chuột công thái học", "Ergonomic mice"],
    ["silent-mice", "Chuột silent", "Silent mice"],
    ["travel-mice", "Chuột du lịch", "Travel mice"],
    ["productivity-mice", "Chuột làm việc", "Productivity mice"],
    ["lightweight-mice", "Chuột siêu nhẹ", "Lightweight mice"],
    ["trackballs", "Chuột trackball", "Trackballs"],
    ["wired-mice", "Chuột có dây", "Wired mice"],
    ["vertical-mice", "Chuột đứng", "Vertical mice"],
    ["mousepads", "Lót chuột", "Mouse pads"],
  ],
  [
    ["4k-monitors", "Màn hình 4K", "4K monitors"],
    ["qhd-monitors", "Màn hình QHD", "QHD monitors"],
    ["gaming-monitors", "Màn hình gaming", "Gaming monitors"],
    ["fhd-monitors", "Màn hình Full HD", "Full HD monitors"],
    ["ultrawide-monitors", "Màn hình ultrawide", "Ultrawide monitors"],
    ["creator-monitors", "Màn hình đồ họa", "Creator monitors"],
    ["portable-monitors", "Màn hình di động", "Portable monitors"],
    ["high-refresh-monitors", "Màn hình tần số quét cao", "High-refresh monitors"],
    ["oled-monitors", "Màn hình OLED", "OLED monitors"],
    ["monitor-arms", "Giá đỡ màn hình", "Monitor arms"],
    ["monitor-lights", "Đèn màn hình", "Monitor lights"],
  ],
  [
    ["gaming-headsets", "Tai nghe gaming", "Gaming headsets"],
    ["wireless-earbuds", "Tai nghe true wireless", "True wireless earbuds"],
    ["noise-cancelling", "Tai nghe chống ồn", "Noise-cancelling headphones"],
    ["studio-headphones", "Tai nghe kiểm âm", "Studio headphones"],
    ["desktop-speakers", "Loa máy tính", "Desktop speakers"],
    ["microphones", "Microphone", "Microphones"],
    ["usb-microphones", "Microphone USB", "USB microphones"],
    ["audio-interfaces", "Sound card & audio interface", "Audio interfaces"],
    ["headphone-dacs", "DAC & amplifier tai nghe", "Headphone DACs and amps"],
    ["conference-audio", "Thiết bị họp trực tuyến", "Conference audio"],
    ["soundbars", "Loa thanh", "Soundbars"],
  ],
  [
    ["usb-hubs", "USB hub", "USB hubs"],
    ["docking-stations", "Docking station", "Docking stations"],
    ["adapters", "Cáp chuyển đổi", "Adapters"],
    ["cables", "Cáp kết nối", "Cables"],
    ["laptop-stands", "Giá đỡ laptop", "Laptop stands"],
    ["webcams", "Webcam", "Webcams"],
    ["chargers", "Bộ sạc", "Chargers"],
    ["desk-accessories", "Phụ kiện bàn làm việc", "Desk accessories"],
    ["streaming", "Thiết bị streaming", "Streaming gear"],
    ["controllers", "Tay cầm chơi game", "Controllers"],
    ["storage", "Lưu trữ di động", "Portable storage"],
  ],
].flatMap((group, rootIndex) =>
  group.map((entry) => {
    const [slug, name, nameEn] = entry as [string, string, string];
    return { slug, name, nameEn, rootSlug: rootCategories[rootIndex]!.slug };
  }),
);

const brandsToSeed = [
  "ANKER", "ASUS", "AUDIO", "AUDIO-TECHNICA", "BASEUS", "BENQ", "BOSE", "DELL", "HYPERX",
  "JBL", "KEYCHRON", "LG", "LOGITECH", "RAZER", "SAMSUNG", "SENNHEISER", "SONY", "STEELSERIES",
  "TECHNEST SELECT", "ACER", "APPLE", "BEYERDYNAMIC", "CANON", "COOLER MASTER", "CORSAIR", "CREATIVE",
  "EPOS", "EPSON", "GIGABYTE", "HARMAN KARDON", "HUAWEI", "JABRA", "KINGSTON", "LIAN LI",
  "LENOVO", "MARSHALL", "MICROSOFT", "MSI", "NVIDIA", "NZXT", "ORICO", "PHILIPS", "PIONEER",
  "SANDISK", "SHURE", "TASCAM", "TP-LINK", "UGREEN", "XIAOMI", "ZOWIE",
];

const specsByRoot: Record<string, Record<string, string[]>> = {
  keyboards: {
    "Kiểu bàn phím": ["Cơ", "Cơ low-profile", "Màng cao cấp"],
    "Kết nối": ["USB-C", "Bluetooth 5.3", "2.4 GHz và Bluetooth"],
    "Layout": ["75%", "TKL", "Full-size", "65%"],
    "Switch": ["Linear", "Tactile", "Silent tactile"],
    "Keycap": ["PBT double-shot", "PBT dye-sub", "ABS phủ mờ"],
    "Đèn nền": ["RGB per-key", "Trắng đơn sắc", "Không đèn nền"],
    "Pin": ["4000 mAh", "6000 mAh", "Dùng có dây"],
    "Bảo hành": ["12 tháng"],
  },
  mice: {
    "Cảm biến": ["Optical 26K DPI", "Optical 30K DPI", "BlueTrack 8K DPI"],
    "Kết nối": ["USB-C 2.4 GHz", "Bluetooth 5.3", "USB-A có dây"],
    "Tốc độ phản hồi": ["1000 Hz", "4000 Hz", "125 Hz"],
    "Số nút": ["5 nút", "7 nút", "9 nút"],
    "Trọng lượng": ["58 g", "76 g", "102 g"],
    "Pin": ["70 giờ", "120 giờ", "Không dùng pin"],
    "Bảo hành": ["12 tháng"],
  },
  monitors: {
    "Tấm nền": ["IPS", "Fast IPS", "VA", "OLED"],
    "Độ phân giải": ["1920 × 1080", "2560 × 1440", "3840 × 2160"],
    "Tần số quét": ["100 Hz", "165 Hz", "240 Hz"],
    "Thời gian phản hồi": ["1 ms", "4 ms", "5 ms"],
    "Cổng kết nối": ["HDMI 2.1, DisplayPort 1.4", "USB-C 90 W, HDMI 2.1", "HDMI 2.0, DisplayPort 1.2"],
    "Độ phủ màu": ["sRGB 99%", "DCI-P3 95%", "sRGB 125%"],
    "Bảo hành": ["36 tháng"],
  },
  audio: {
    "Thiết kế": ["Over-ear", "In-ear", "On-ear", "Để bàn"],
    "Kết nối": ["Bluetooth 5.3", "USB-C", "USB và 3.5 mm", "XLR"],
    "Chống ồn": ["ANC chủ động", "Cách âm thụ động", "Không hỗ trợ ANC"],
    "Thời lượng pin": ["30 giờ", "45 giờ", "Không dùng pin"],
    "Microphone": ["Micro kép khử ồn", "Micro tháo rời", "Không tích hợp"],
    "Bảo hành": ["12 tháng"],
  },
  accessories: {
    "Chất liệu": ["Hợp kim nhôm", "Nhựa ABS tái chế", "Thép sơn tĩnh điện", "Silicone và vải"],
    "Kết nối": ["USB-C 10 Gbps", "USB-C 40 Gbps", "USB-A 5 Gbps", "Bluetooth 5.3"],
    "Tương thích": ["Windows và macOS", "Windows, macOS và Linux", "Thiết bị USB-C"],
    "Nguồn cấp": ["Bus-powered", "Adapter USB-C 100 W", "Pin tích hợp 10000 mAh"],
    "Kích thước": ["Gọn nhẹ cho bàn làm việc", "Thiết kế di động", "Bản mở rộng cho góc setup"],
    "Bảo hành": ["12 tháng"],
  },
};

const brandPools: Record<string, string[]> = {
  keyboards: ["KEYCHRON", "LOGITECH", "ASUS", "CORSAIR", "RAZER", "HYPERX", "STEELSERIES", "MICROSOFT", "APPLE", "DELL", "ACER", "LENOVO", "MSI", "GIGABYTE", "COOLER MASTER", "NZXT", "ZOWIE", "TECHNEST SELECT", "ANKER", "BASEUS", "UGREEN", "HUAWEI", "SAMSUNG", "XIAOMI", "CREATIVE", "KINGSTON"],
  mice: ["LOGITECH", "RAZER", "ASUS", "CORSAIR", "HYPERX", "STEELSERIES", "MICROSOFT", "DELL", "ACER", "LENOVO", "MSI", "GIGABYTE", "COOLER MASTER", "ZOWIE", "KEYCHRON", "APPLE", "HUAWEI", "XIAOMI", "TECHNEST SELECT", "ANKER", "BASEUS", "UGREEN", "NZXT", "PHILIPS"],
  monitors: ["ASUS", "BENQ", "DELL", "LG", "SAMSUNG", "MSI", "ACER", "GIGABYTE", "PHILIPS", "SONY", "APPLE", "HUAWEI", "XIAOMI", "LENOVO", "CORSAIR", "ZOWIE", "EPSON", "TECHNEST SELECT", "RAZER", "NZXT"],
  audio: ["AUDIO", "AUDIO-TECHNICA", "BOSE", "BEYERDYNAMIC", "CREATIVE", "EPOS", "HARMAN KARDON", "HYPERX", "JABRA", "JBL", "LOGITECH", "MARSHALL", "PIONEER", "RAZER", "SENNHEISER", "SHURE", "SONY", "STEELSERIES", "TASCAM", "APPLE", "SAMSUNG", "XIAOMI", "HUAWEI", "PHILIPS", "MICROSOFT", "CORSAIR"],
  accessories: ["ANKER", "BASEUS", "UGREEN", "ORICO", "TP-LINK", "SANDISK", "KINGSTON", "LOGITECH", "MICROSOFT", "ASUS", "CORSAIR", "COOLER MASTER", "NZXT", "LIAN LI", "APPLE", "ACER", "DELL", "HUAWEI", "SAMSUNG", "XIAOMI", "CANON", "EPSON", "GIGABYTE", "LENOVO", "MSI", "NVIDIA", "PHILIPS", "PIONEER", "CREATIVE", "TECHNEST SELECT"],
};

const subcategoryCues: Record<string, string> = {
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

const categorySpecificSpecs: Record<string, Record<string, string[]>> = {
  keycaps: { "Profile keycap": ["Cherry", "OEM", "OSA", "XDA"], "Chất liệu": ["PBT double-shot", "PBT dye-sub", "ABS phủ mờ"], "Số phím": ["Keycap set 129 phím", "Keycap set 142 phím"], "Layout hỗ trợ": ["ANSI 60%–TKL", "ANSI full-size"] },
  switches: { "Loại switch": ["Linear", "Tactile", "Silent linear"], "Lực nhấn": ["45 gf", "55 gf", "62 gf"], "Hành trình": ["3.6 mm", "4.0 mm"], "Đóng gói": ["35 switches", "70 switches", "110 switches"] },
  mousepads: { "Bề mặt": ["Control vải dệt", "Speed polyester", "Hard polymer"], "Kích thước": ["450 × 400 mm", "900 × 400 mm", "320 × 270 mm"], "Đế": ["Cao su chống trượt", "PU foam"], "Viền": ["May viền thấp", "Không viền"] },
  "monitor-arms": { "Chuẩn ngàm": ["VESA 75 × 75", "VESA 100 × 100"], "Tải trọng": ["2–9 kg", "3–12 kg"], "Số màn hình": ["1 màn hình", "2 màn hình"], "Điều chỉnh": ["Nâng hạ, xoay, nghiêng"] },
  "monitor-lights": { "Nhiệt độ màu": ["2700–6500 K", "3000–6500 K"], "Điều khiển": ["Núm xoay", "Cảm ứng"], "Nguồn": ["USB-C 5 V"], "Chiều dài": ["40 cm", "50 cm"] },
  "wireless-earbuds": { "Bluetooth": ["5.3", "5.4"], "Thời lượng pin": ["6 giờ + 24 giờ hộp sạc", "8 giờ + 32 giờ hộp sạc"], "Chống ồn": ["ANC thích ứng", "ENC cuộc gọi"], "Kháng nước": ["IPX4", "IP54"], "Driver": ["Dynamic 10 mm", "Hybrid driver"] },
  microphones: { "Kiểu thu": ["Dynamic cardioid", "Condenser cardioid"], "Cổng ra": ["XLR", "XLR và USB-C"], "Đáp tuyến": ["50 Hz–16 kHz", "20 Hz–20 kHz"], "Phụ kiện": ["Shock mount", "Pop filter"] },
  "usb-microphones": { "Kiểu thu": ["Condenser cardioid", "Dynamic cardioid"], "Độ phân giải": ["24-bit / 96 kHz", "24-bit / 48 kHz"], "Kết nối": ["USB-C"], "Monitoring": ["Headphone jack zero-latency"] },
  "audio-interfaces": { "Đầu vào": ["2 combo XLR/TRS", "4 combo XLR/TRS"], "Độ phân giải": ["24-bit / 192 kHz", "24-bit / 96 kHz"], "Nguồn phantom": ["48 V"], "Kết nối": ["USB-C"] },
  "headphone-dacs": { "Chip DAC": ["ESS 32-bit", "Cirrus Logic 32-bit"], "Độ phân giải tối đa": ["32-bit / 768 kHz", "32-bit / 384 kHz"], "Ngõ ra": ["3.5 mm và 4.4 mm", "6.3 mm"], "Kết nối": ["USB-C"] },
  soundbars: { "Cấu hình kênh": ["2.0", "2.1"], "Công suất": ["40 W", "80 W"], "Kết nối": ["Bluetooth, HDMI ARC, Optical"], "Điều khiển": ["Remote và nút vật lý"] },
  "usb-hubs": { "Cổng kết nối": ["4 × USB-A, 1 × USB-C", "2 × USB-A, HDMI, SD"], "Băng thông": ["USB 3.2 Gen 2", "USB 4"], "Nguồn": ["Bus-powered", "USB-C PD passthrough"] },
  "docking-stations": { "Giao tiếp": ["Thunderbolt 4", "USB4 40 Gbps"], "Cổng màn hình": ["2 × HDMI 2.1", "2 × DisplayPort 1.4"], "Sạc host": ["USB-C PD 100 W", "USB-C PD 85 W"], "Ethernet": ["2.5 GbE"] },
  adapters: { "Chuẩn cổng": ["USB-C to HDMI 2.1", "USB-C to DisplayPort 1.4", "USB-C to Ethernet 2.5 GbE"], "Độ phân giải": ["4K 120 Hz", "8K 60 Hz"], "Vỏ": ["Hợp kim nhôm"] },
  cables: { "Chuẩn": ["USB-C 3.2 Gen 2", "USB-C USB4 40 Gbps"], "Công suất sạc": ["60 W", "100 W", "240 W"], "Chiều dài": ["1 m", "1.5 m", "2 m"], "Chất liệu": ["Bện nylon"] },
  "laptop-stands": { "Chất liệu": ["Hợp kim nhôm", "Nhôm CNC"], "Điều chỉnh": ["Gập gọn, nâng hạ", "Nâng góc 6 mức"], "Tương thích": ["Laptop 11–16 inch"], "Tải trọng": ["Tối đa 8 kg"] },
  webcams: { "Độ phân giải": ["1080p 60 fps", "4K 30 fps"], "Lấy nét": ["Autofocus", "Fixed focus"], "Microphone": ["Micro kép khử ồn"], "Kết nối": ["USB-C"], "Màn trập": ["Privacy shutter"] },
  chargers: { "Công suất": ["65 W", "100 W", "140 W"], "Cổng": ["2 × USB-C, 1 × USB-A", "3 × USB-C"], "Công nghệ": ["GaN III", "PD 3.1 và PPS"], "Bảo vệ": ["Quá nhiệt, quá dòng, quá áp"] },
  "desk-accessories": { "Chất liệu": ["Hợp kim nhôm", "Thép sơn tĩnh điện", "Silicone và vải"], "Thiết kế": ["Modular", "Chống trượt"], "Kích thước": ["Thiết kế gọn cho bàn 120 cm"] },
  streaming: { "Đầu vào": ["HDMI 2.0", "HDMI 2.1"], "Capture": ["1080p 60 fps", "4K 60 fps passthrough"], "Kết nối máy tính": ["USB 3.2"], "Tương thích": ["OBS Studio, Windows, macOS"] },
  controllers: { "Kết nối": ["2.4 GHz, Bluetooth, USB-C"], "Pin": ["20 giờ", "30 giờ"], "Nút": ["Hall-effect triggers", "Nút lập trình phía sau"], "Tương thích": ["Windows, Android, Steam"] },
  storage: { "Dung lượng": ["1 TB", "2 TB", "4 TB"], "Giao tiếp": ["USB 3.2 Gen 2", "USB4 40 Gbps"], "Tốc độ đọc": ["1050 MB/s", "2000 MB/s"], "Bảo vệ": ["Chống sốc và mã hóa phần cứng"] },
};

const firstNames = ["Minh Anh", "Gia Huy", "Khánh Linh", "Hoàng Nam", "Bảo Trân", "Quốc Bảo", "Thảo Vy", "Tuấn Kiệt", "Hải Yến", "Đức Minh", "Ngọc Hà", "Phúc An"];
const surnames = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Phan"];
const streets = ["Nguyễn Trãi", "Lê Lợi", "Cách Mạng Tháng Tám", "Phan Xích Long", "Điện Biên Phủ", "Trần Hưng Đạo", "Nguyễn Văn Cừ", "Võ Văn Tần"];
const districts = ["Quận 1", "Quận 3", "Quận 7", "Bình Thạnh", "Cầu Giấy", "Đống Đa", "Hải Châu", "Ninh Kiều"];
const cities = ["Hồ Chí Minh", "Hà Nội", "Đà Nẵng", "Cần Thơ"];
const colors = ["Graphite", "Arctic White", "Midnight", "Silver", "Forest Green", "Sandstone"];
const slugify = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const allCategories = [
  ...rootCategories.map((item) => ({ ...item, parentCategoryId: null as string | null })),
  ...subcategories.map((item) => ({ ...item, parentCategoryId: item.rootSlug })),
];

function specsFor(root: string, ordinal: number, categorySlug = "") {
  const specs = categorySpecificSpecs[categorySlug] || specsByRoot[root]!;
  return Object.fromEntries(Object.entries(specs).map(([label, values]) => [label, values[ordinal % values.length]]));
}

function priceFor(root: string, ordinal: number) {
  const bands: Record<string, [number, number]> = {
    keyboards: [590000, 7990000], mice: [190000, 4990000], monitors: [1890000, 29990000],
    audio: [290000, 12990000], accessories: [90000, 5990000],
  };
  const [min, max] = bands[root]!;
  const step = 10000;
  return Math.round((min + ((ordinal * 7919) % (max - min))) / step) * step;
}

function svgIllustration(root: string, label: string, view: number, slug: string) {
  const escapedLabel = label.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const accents = ["#ff5a00", "#1d4ed8", "#0f766e", "#7c3aed", "#d97706"];
  const accent = accents[parseInt(hash(slug).slice(0, 2), 16) % accents.length]!;
  const background = ["#f5f7fa", "#fff4ed", "#eef4f8"][view - 1]!;
  const art = root === "keyboards"
    ? `<rect x="190" y="170" width="520" height="250" rx="28" fill="#222831"/><g fill="#e8edf2">${Array.from({ length: 40 }, (_, i) => `<rect x="${210 + (i % 8) * 59}" y="${190 + Math.floor(i / 8) * 43}" width="48" height="31" rx="6"/>`).join("")}</g><rect x="328" y="319" width="210" height="28" rx="6" fill="${accent}"/>`
    : root === "mice"
      ? `<path d="M450 155c-120 0-205 72-205 185 0 90 78 145 205 145s205-55 205-145c0-113-85-185-205-185Z" fill="#222831"/><path d="M450 157v135" stroke="#717985" stroke-width="8"/><rect x="432" y="191" width="36" height="55" rx="18" fill="${accent}"/>`
      : root === "monitors"
        ? `<rect x="190" y="125" width="520" height="300" rx="22" fill="#20252d"/><rect x="210" y="145" width="480" height="260" rx="10" fill="url(#screen)"/><path d="M450 425v78m-110 15h220" stroke="#737d89" stroke-width="24" stroke-linecap="round"/>`
        : root === "audio"
          ? `<path d="M260 335v-65c0-120 75-195 190-195s190 75 190 195v65" fill="none" stroke="#242a33" stroke-width="38" stroke-linecap="round"/><rect x="225" y="300" width="105" height="175" rx="34" fill="${accent}"/><rect x="570" y="300" width="105" height="175" rx="34" fill="#242a33"/><path d="M575 485q-22 64-105 64h-20" fill="none" stroke="#59616c" stroke-width="14"/>`
          : `<rect x="210" y="190" width="480" height="240" rx="28" fill="#242a33"/><rect x="245" y="225" width="410" height="170" rx="16" fill="#e8edf2"/><circle cx="330" cy="310" r="34" fill="${accent}"/><circle cx="450" cy="310" r="34" fill="#8895a5"/><circle cx="570" cy="310" r="34" fill="#c6ced8"/><path d="M270 455h370" stroke="#242a33" stroke-width="18" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" role="img" aria-labelledby="title"><title id="title">Ảnh minh họa ${escapedLabel}</title><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#fff"/></linearGradient><linearGradient id="screen" x2="1" y2="1"><stop stop-color="${accent}"/><stop offset="1" stop-color="#131923"/></linearGradient><filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="20" stdDeviation="18" flood-color="#1a2430" flood-opacity=".16"/></filter></defs><rect width="900" height="600" fill="url(#bg)"/><circle cx="735" cy="130" r="105" fill="${accent}" opacity=".08"/><ellipse cx="450" cy="470" rx="280" ry="40" fill="#18202c" opacity=".08"/><g filter="url(#shadow)">${art}</g><rect x="42" y="42" width="10" height="70" rx="5" fill="${accent}"/><text x="75" y="78" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="#1f2937">TECHNEST · ẢNH MINH HỌA</text><text x="75" y="108" font-family="Arial,sans-serif" font-size="18" fill="#64748b">${escapedLabel}</text><text x="820" y="555" text-anchor="end" font-family="Arial,sans-serif" font-size="15" fill="#64748b">Góc ${view} · Dữ liệu phát triển</text></svg>`;
}

async function chunks<T>(items: T[], size: number, run: (batch: T[]) => Promise<unknown>) {
  for (let index = 0; index < items.length; index += size) await run(items.slice(index, index + size));
}

try {
  const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../public/images/catalog-illustrations");
  await mkdir(publicDir, { recursive: true });
  for (const category of allCategories) {
    const safeLabel = category.name;
    for (let view = 1; view <= 3; view += 1) {
      await writeFile(path.join(publicDir, `${category.slug}-view-${view}.svg`), svgIllustration(category.parentCategoryId || category.slug, safeLabel, view, category.slug));
    }
  }

  const seedCustomers = Array.from({ length: 120 }, (_, index) => {
    const first = firstNames[index % firstNames.length]!;
    const surname = surnames[Math.floor(index / firstNames.length) % surnames.length]!;
    return { email: `catalog.customer.${String(index + 1).padStart(3, "0")}@technest.example`, fullName: `${surname} ${first}`, phone: `+849${String(10000000 + index).slice(1)}`, index };
  });

  await db.transaction(async (tx) => {
    for (const category of rootCategories) {
      await tx.insert(categories).values(category).onConflictDoUpdate({ target: categories.slug, set: { name: category.name, nameEn: category.nameEn } });
    }
    const roots = await tx.select({ id: categories.id, slug: categories.slug }).from(categories).where(isNull(categories.parentCategoryId));
    const rootIds = new Map(roots.map((category) => [category.slug, category.id]));
    for (const category of subcategories) {
      const parentCategoryId = rootIds.get(category.rootSlug);
      if (!parentCategoryId) throw new Error(`Missing parent category: ${category.rootSlug}`);
      await tx.insert(categories).values({ slug: category.slug, name: category.name, nameEn: category.nameEn, parentCategoryId }).onConflictDoUpdate({ target: categories.slug, set: { name: category.name, nameEn: category.nameEn, parentCategoryId } });
    }
    await chunks(brandsToSeed, 100, async (batch) => {
      await tx.insert(brands).values(batch.map((name) => ({ name, slug: slugify(name) }))).onConflictDoNothing();
    });
    const categoryRows = await tx.select({ id: categories.id, slug: categories.slug, parentCategoryId: categories.parentCategoryId }).from(categories);
    const categoryIds = new Map(categoryRows.map((category) => [category.slug, category.id]));
    const brandRows = await tx.select({ id: brands.id, name: brands.name }).from(brands);
    const brandIds = new Map(brandRows.map((brand) => [brand.name, brand.id]));
    const existingProducts = await tx.select({ id: products.id, slug: products.slug, categoryId: products.categoryId, attributes: products.attributes, name: products.name, categorySlug: categories.slug }).from(products).innerJoin(categories, eq(products.categoryId, categories.id));
    const knownSlugs = new Set(existingProducts.map((item) => item.slug));
    const rootById = new Map(categoryRows.filter((item) => rootCategories.some((root) => root.slug === item.slug)).map((item) => [item.id, item.slug]));
    const existingBySeedKey = new Map<string, (typeof existingProducts)[number]>();
    for (const item of existingProducts) {
      if (item.attributes?.dataset !== "development-illustration") continue;
      const savedOrdinal = typeof item.attributes.seedOrdinal === "number" ? item.attributes.seedOrdinal : Number(item.name.match(/\s(\d+)\s(?:Graphite|Arctic White|Midnight|Silver|Forest Green|Sandstone)$/)?.[1]) - 100;
      if (Number.isInteger(savedOrdinal) && savedOrdinal >= 0 && savedOrdinal < 90) existingBySeedKey.set(`${item.categorySlug}:${savedOrdinal}`, item);
    }
    const productRows: Array<typeof products.$inferInsert> = [];
    const descriptors: Array<{ seedKey: string; slug: string; root: string; categorySlug: string; name: string; brand: string; ordinal: number; price: number; compare: number | null; attributes: Record<string, unknown>; categoryId: string; brandId: bigint; description: string }> = [];
    for (const [categoryIndex, category] of subcategories.entries()) {
      const root = category.rootSlug;
      for (let ordinal = 0; ordinal < 90; ordinal += 1) {
        const seedKey = `${category.slug}:${ordinal}`;
        const brandPool = brandPools[root]!;
        const brand = brandPool[(ordinal * 7 + categoryIndex * 3) % brandPool.length]!;
        const cue = subcategoryCues[category.slug]!;
        const name = `${brand} ${cue} ${100 + ordinal} ${colors[(ordinal + categoryIndex) % colors.length]}`;
        const slug = `catalog-${slugify(name)}-${category.slug}`;
        if (!existingBySeedKey.has(seedKey) && knownSlugs.has(slug)) continue;
        const price = priceFor(root, ordinal + categoryIndex * 29);
        const compare = ordinal % 3 === 0 ? Math.round(price * 1.12 / 10000) * 10000 : null;
        const attributes = {
          specifications: specsFor(root, ordinal + categoryIndex, category.slug),
          warranty: specsByRoot[root]!["Bảo hành"]![0],
          finish: colors[(ordinal + 2) % colors.length],
          dataset: "development-illustration",
          categoryLabel: category.name,
          seedKey,
          seedOrdinal: ordinal,
          note: "Sản phẩm minh họa được tạo cho kiểm thử phát triển; tên model và cấu hình không phải datasheet chính thức của hãng.",
        };
        const categoryId = categoryIds.get(category.slug);
        const brandId = brandIds.get(brand);
        if (!categoryId || !brandId) throw new Error(`Missing category/brand for ${slug}`);
        const description = `${name} được thiết kế cho ${category.name.toLowerCase()}, phù hợp với góc làm việc và giải trí hiện đại. Cấu hình được tuyển chọn theo nhu cầu ${root === "audio" ? "nghe nhạc, họp trực tuyến và sáng tạo nội dung" : root === "monitors" ? "làm việc đa nhiệm, chơi game và sáng tạo nội dung" : "sử dụng hằng ngày, học tập và làm việc"}. Đây là sản phẩm minh họa phục vụ kiểm thử Technest; tên model và thông số không đại diện cho tài liệu chính thức của nhà sản xuất.`;
        const descriptor = { seedKey, slug, root, categorySlug: category.slug, name, brand, ordinal, price, compare, attributes, categoryId, brandId, description };
        descriptors.push(descriptor);
        if (!existingBySeedKey.has(seedKey)) productRows.push({ slug, name, description, categoryId, brandId, price: String(price), compareAtPrice: compare ? String(compare) : null, attributes, badge: ordinal % 4 === 0 ? "popular" : null, isFeatured: descriptors.length < 20, featuredRank: descriptors.length < 20 ? descriptors.length : null, isTrending: ordinal < 5, trendingRank: ordinal < 5 ? ordinal : null, compatibleWith: ["Windows", "macOS"], status: "ACTIVE", createdAt: new Date(Date.UTC(2025 + (ordinal % 2), (ordinal * 3) % 12, 1 + (ordinal % 27))) });
      }
    }

    await chunks(productRows, 150, async (batch) => {
      await tx.insert(products).values(batch).onConflictDoNothing({ target: products.slug });
    });
    const allProductRows = await tx.select({ id: products.id, slug: products.slug, categoryId: products.categoryId, attributes: products.attributes, name: products.name, price: products.price, categorySlug: categories.slug }).from(products).innerJoin(categories, eq(products.categoryId, categories.id));
    const descriptorBySlug = new Map(descriptors.map((item) => [item.slug, item]));
    const descriptorBySeedKey = new Map(descriptors.map((item) => [item.seedKey, item]));
    const descriptorFor = (product: (typeof allProductRows)[number]) => {
      const seedKey = product.attributes?.seedKey;
      return (typeof seedKey === "string" ? descriptorBySeedKey.get(seedKey) : undefined) || descriptorBySlug.get(product.slug);
    };
    for (const item of existingProducts) {
      const root = rootById.get(item.categoryId) || "accessories";
      if (item.attributes?.dataset === "development-illustration") {
        const savedOrdinal = typeof item.attributes.seedOrdinal === "number" ? item.attributes.seedOrdinal : Number(item.name.match(/\s(\d+)\s(?:Graphite|Arctic White|Midnight|Silver|Forest Green|Sandstone)$/)?.[1]) - 100;
        const descriptor = descriptorBySeedKey.get(`${item.categorySlug}:${savedOrdinal}`);
        if (descriptor) {
          await tx.update(products).set({ name: descriptor.name, description: descriptor.description, brandId: descriptor.brandId, price: String(descriptor.price), compareAtPrice: descriptor.compare ? String(descriptor.compare) : null, attributes: descriptor.attributes, updatedAt: new Date() }).where(eq(products.id, item.id));
        }
      } else if (!item.attributes || Object.keys(item.attributes).length === 0) {
        await tx.update(products).set({ attributes: { specifications: specsFor(root, Number(item.id % 13n)), warranty: specsByRoot[root]!["Bảo hành"]![0], dataset: "curated-catalog", note: "Thông số biên tập phục vụ giao diện; kiểm tra datasheet hãng trước khi bán thực tế." } }).where(eq(products.id, item.id));
      }
    }
    await tx.execute(sql`UPDATE order_items oi SET product_name = p.name FROM products p WHERE p.id = oi.product_id AND p.attributes->>'dataset' = 'development-illustration'`);

    const currentVariants = await tx.select({ id: productVariants.id, productId: productVariants.productId, sku: productVariants.sku, price: productVariants.price, compareAtPrice: productVariants.compareAtPrice, name: productVariants.name }).from(productVariants);
    const variantsByProduct = new Map<string, typeof currentVariants>();
    for (const variant of currentVariants) variantsByProduct.set(variant.productId.toString(), [...(variantsByProduct.get(variant.productId.toString()) || []), variant]);
    const newVariantRows: Array<typeof productVariants.$inferInsert> = [];
    for (const product of allProductRows) {
      const current = variantsByProduct.get(product.id.toString()) || [];
      const descriptor = descriptorFor(product);
      const root = descriptor?.root || rootById.get(product.categoryId) || "accessories";
      const productPrice = descriptor?.price || Number(current[0]?.price || 100000);
      const existingCount = current.length;
      for (let option = existingCount; option < 2; option += 1) {
        const color = colors[(option + Number(product.id % BigInt(colors.length))) % colors.length]!;
        const sku = `TN-${hash(product.slug).slice(0, 12).toUpperCase()}-${option + 1}`;
        newVariantRows.push({ productId: product.id, sku, name: color, price: String(productPrice + option * 100000), compareAtPrice: null, attributes: { color, option: option + 1, warranty: specsByRoot[root]!["Bảo hành"]![0] }, status: "ACTIVE" });
      }
    }
    await chunks(newVariantRows, 200, async (batch) => {
      await tx.insert(productVariants).values(batch).onConflictDoNothing({ target: productVariants.sku });
    });
    const allVariants = await tx.select({ id: productVariants.id, productId: productVariants.productId, sku: productVariants.sku, price: productVariants.price, name: productVariants.name }).from(productVariants).where(eq(productVariants.status, "ACTIVE"));
    const inventoryRows = await tx.select({ variantId: inventories.variantId }).from(inventories);
    const existingInventory = new Set(inventoryRows.map((item) => item.variantId.toString()));
    const newInventories = allVariants.filter((item) => !existingInventory.has(item.id.toString())).map((item, index) => ({ variantId: item.id, onHand: 24 + (index % 17), reserved: 0 }));
    await chunks(newInventories, 500, async (batch) => { await tx.insert(inventories).values(batch).onConflictDoNothing(); });

    const currentImages = await tx.select({ productId: productImages.productId, sortOrder: productImages.sortOrder }).from(productImages);
    const imageCounts = new Map<string, number>();
    for (const image of currentImages) imageCounts.set(image.productId.toString(), (imageCounts.get(image.productId.toString()) || 0) + 1);
    const variantByProduct = new Map<string, typeof allVariants>();
    for (const variant of allVariants) variantByProduct.set(variant.productId.toString(), [...(variantByProduct.get(variant.productId.toString()) || []), variant]);
    const imageRows: Array<typeof productImages.$inferInsert> = [];
    for (const product of allProductRows) {
      const count = imageCounts.get(product.id.toString()) || 0;
      const descriptor = descriptorFor(product);
      const root = descriptor?.root || rootById.get(product.categoryId) || "accessories";
      const variantId = variantByProduct.get(product.id.toString())?.[0]?.id;
      for (let view = count + 1; view <= 3; view += 1) {
        const imageSlug = descriptor?.categorySlug || root;
        const url = `/images/catalog-illustrations/${imageSlug}-view-${view}.svg`;
        imageRows.push({ productId: product.id, variantId: variantId ?? null, url, altText: `Ảnh minh họa ${product.name} · không phải ảnh chính thức của nhà sản xuất`, sortOrder: view - 1 });
      }
    }
    await chunks(imageRows, 500, async (batch) => { await tx.insert(productImages).values(batch); });

    const seedPasswordHash = await argon2.hash("TechnestDemo!2026");
    await chunks(seedCustomers, 100, async (batch) => {
      await tx.insert(users).values(batch.map(({ email, fullName, phone }) => ({ email, passwordHash: seedPasswordHash, fullName, phone, role: "CUSTOMER" as const, status: "ACTIVE" as const }))).onConflictDoNothing({ target: users.email });
    });
    const savedCustomers = await tx.select({ id: users.id, email: users.email, fullName: users.fullName, phone: users.phone }).from(users).where(inArray(users.email, seedCustomers.map((customer) => customer.email)));
    const customerByEmail = new Map(savedCustomers.map((customer) => [customer.email, customer]));
    const existingAddresses = await tx.select({ userId: userAddresses.userId }).from(userAddresses).where(inArray(userAddresses.userId, savedCustomers.map((customer) => customer.id)));
    const addressesPresent = new Set(existingAddresses.map((address) => address.userId));
    const addressRows = seedCustomers.flatMap((customer) => {
      const saved = customerByEmail.get(customer.email);
      if (!saved || addressesPresent.has(saved.id)) return [];
      const city = cities[customer.index % cities.length]!;
      return [{ userId: saved.id, recipientName: saved.fullName || customer.fullName, phone: saved.phone || customer.phone, addressLine: `${18 + customer.index} ${streets[customer.index % streets.length]}`, city, district: districts[customer.index % districts.length], ward: `Phường ${(customer.index % 12) + 1}`, label: "Nhà riêng", isDefault: true }];
    });
    await chunks(addressRows, 200, async (batch) => { await tx.insert(userAddresses).values(batch); });

    const seededOrders = await tx.select({ orderNumber: orders.orderNumber }).from(orders).where(sql`${orders.orderNumber} LIKE 'TN-DEMO-%'`);
    const knownOrderNumbers = new Set(seededOrders.map((order) => order.orderNumber));
    const productForOrders = allProductRows.filter((product) => product.attributes?.dataset === "development-illustration").sort((a, b) => a.slug.localeCompare(b.slug));
    const variantsForOrders = new Map<string, (typeof allVariants)[number]>();
    for (const variant of allVariants) if (!variantsForOrders.has(variant.productId.toString())) variantsForOrders.set(variant.productId.toString(), variant);
    const localImageByProduct = new Map<string, string>();
    const firstImages = await tx.select({ productId: productImages.productId, url: productImages.url }).from(productImages).orderBy(productImages.sortOrder);
    for (const image of firstImages) if (!localImageByProduct.has(image.productId.toString())) localImageByProduct.set(image.productId.toString(), image.url);
    type OrderLine = Omit<typeof orderItems.$inferInsert, "orderId">;
    const candidateOrders: Array<{ orderNumber: string; values: typeof orders.$inferInsert; lines: OrderLine[]; status: "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED"; userId: bigint; date: Date }> = [];
    const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "CANCELLED"] as const;
    for (let index = 0; index < 2000; index += 1) {
      const orderNumber = `TN-DEMO-${String(index + 1).padStart(6, "0")}`;
      if (knownOrderNumbers.has(orderNumber)) continue;
      const customer = seedCustomers[index % seedCustomers.length]!;
      const user = customerByEmail.get(customer.email)!;
      const status = statuses[index % statuses.length]!;
      const date = new Date(Date.UTC(2025 + Math.floor((index % 22) / 12), index % 12, 1 + (index % 27), 8 + (index % 10), index % 60));
      const itemCount = index < 1000 ? 2 : 3;
      const lines: OrderLine[] = [];
      let subtotal = 0;
      for (let lineIndex = 0; lineIndex < itemCount; lineIndex += 1) {
        const product = productForOrders[(index * 3 + lineIndex * 37) % productForOrders.length]!;
        const variant = variantsForOrders.get(product.id.toString());
        if (!variant) throw new Error(`No variant for order fixture product ${product.slug}`);
        const quantity = (index + lineIndex) % 9 === 0 ? 2 : 1;
        const unitPrice = Number(variant.price || product.price || 0);
        const lineTotal = unitPrice * quantity;
        subtotal += lineTotal;
        lines.push({ productId: product.id, variantId: variant.id, productName: product.name, variantName: variant.name, sku: variant.sku, imageUrl: localImageByProduct.get(product.id.toString()) || null, quantity, unitPrice: BigInt(unitPrice), lineTotal: BigInt(lineTotal), createdAt: date });
      }
      const shippingFee = subtotal >= 1000000 ? 0 : 30000;
      const requestHash = hash(JSON.stringify({ orderNumber, user: user.id, items: lines.map((line) => [line.sku, line.quantity, line.unitPrice.toString()]) }));
      candidateOrders.push({ orderNumber, status, userId: BigInt(user.id), date, lines, values: { orderNumber, userId: BigInt(user.id), idempotencyKey: `seed:${orderNumber}`, requestHash, status, paymentMethod: "COD", paymentStatus: "UNPAID", subtotal: BigInt(subtotal), shippingFee: BigInt(shippingFee), discountAmount: 0n, totalAmount: BigInt(subtotal + shippingFee), shippingFullName: user.fullName || customer.fullName, shippingPhone: user.phone || customer.phone, customerEmail: user.email, shippingAddress: `${18 + customer.index} ${streets[customer.index % streets.length]}`, shippingCity: cities[customer.index % cities.length]!, shippingDistrict: districts[customer.index % districts.length]!, shippingWard: `Phường ${(customer.index % 12) + 1}`, customerNote: "Đơn minh họa phục vụ kiểm thử môi trường phát triển.", createdAt: date, updatedAt: date } });
    }

    const insertedOrderRows: Array<{ id: bigint; orderNumber: string }> = [];
    await chunks(candidateOrders, 100, async (batch) => {
      insertedOrderRows.push(...await tx.insert(orders).values(batch.map((item) => item.values)).onConflictDoNothing({ target: orders.orderNumber }).returning({ id: orders.id, orderNumber: orders.orderNumber }));
    });
    const candidateByNumber = new Map(candidateOrders.map((order) => [order.orderNumber, order]));
    const insertedItems: Array<typeof orderItems.$inferInsert> = [];
    const histories: Array<typeof orderStatusHistory.$inferInsert> = [];
    const statusPath: Record<(typeof statuses)[number], (typeof statuses)[number][]> = {
      PENDING: ["PENDING"], CONFIRMED: ["PENDING", "CONFIRMED"], PROCESSING: ["PENDING", "CONFIRMED", "PROCESSING"],
      SHIPPED: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"], DELIVERED: ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"], CANCELLED: ["PENDING", "CANCELLED"],
    };
    for (const inserted of insertedOrderRows) {
      const fixture = candidateByNumber.get(inserted.orderNumber)!;
      for (const line of fixture.lines) insertedItems.push({ ...line, orderId: inserted.id });
      const states = statusPath[fixture.status];
      for (let i = 0; i < states.length; i += 1) histories.push({ orderId: inserted.id, fromStatus: i ? states[i - 1]! : null, toStatus: states[i]!, changedBy: null, note: "Bản ghi lịch sử đơn minh họa", createdAt: new Date(fixture.date.getTime() + i * 60000) });
    }
    await chunks(insertedItems, 500, async (batch) => { await tx.insert(orderItems).values(batch); });
    await chunks(histories, 500, async (batch) => { await tx.insert(orderStatusHistory).values(batch); });

    const reservations: Array<typeof inventoryReservations.$inferInsert> = [];
    const orderReservationLinks: Array<typeof orderInventoryReservations.$inferInsert> = [];
    const movements: Array<typeof inventoryMovements.$inferInsert> = [];
    const inventoryDeltas = new Map<string, { onHand: number; reserved: number }>();
    const inventoryByVariant = new Map((await tx.select().from(inventories)).map((row) => [row.variantId.toString(), row]));
    for (const inserted of insertedOrderRows) {
      const fixture = candidateByNumber.get(inserted.orderNumber)!;
      for (const line of fixture.lines) {
        const variantId = line.variantId.toString();
        const delta = inventoryDeltas.get(variantId) || { onHand: 0, reserved: 0 };
        const quantity = line.quantity;
        if (["PENDING", "CONFIRMED", "PROCESSING"].includes(fixture.status)) {
          delta.reserved += quantity;
          const expiresAt = new Date("2099-12-31T00:00:00.000Z");
          reservations.push({ variantId: BigInt(variantId), quantity, status: "ACTIVE", expiresAt, referenceType: "ORDER", referenceId: inserted.orderNumber, createdAt: fixture.date, updatedAt: fixture.date });
          movements.push({ variantId: BigInt(variantId), type: "RESERVE", quantity, referenceType: "ORDER", referenceId: inserted.orderNumber, idempotencyKey: `seed-reserve:${inserted.orderNumber}:${line.sku}:${line.productId}`, metadata: { seed: true }, createdAt: fixture.date });
        } else if (["SHIPPED", "DELIVERED"].includes(fixture.status)) {
          delta.onHand -= quantity;
          movements.push({ variantId: BigInt(variantId), type: "OUTBOUND", quantity, referenceType: "ORDER", referenceId: inserted.orderNumber, idempotencyKey: `seed-outbound:${inserted.orderNumber}:${line.sku}:${line.productId}`, metadata: { seed: true }, createdAt: fixture.date });
        }
        inventoryDeltas.set(variantId, delta);
      }
    }
    if (reservations.length) {
      const savedReservations: Array<typeof inventoryReservations.$inferSelect> = [];
      await chunks(reservations, 500, async (batch) => {
        savedReservations.push(...await tx.insert(inventoryReservations).values(batch).returning());
      });
      const linkByRef = new Map(insertedOrderRows.map((item) => [item.orderNumber, item.id]));
      for (let i = 0; i < savedReservations.length; i += 1) {
        const reservation = savedReservations[i]!;
        const orderId = linkByRef.get(reservation.referenceId);
        if (orderId) orderReservationLinks.push({ orderId, reservationId: reservation.id });
      }
      await chunks(orderReservationLinks, 500, async (batch) => { await tx.insert(orderInventoryReservations).values(batch).onConflictDoNothing(); });
    }
    await chunks(movements, 500, async (batch) => {
      await tx.insert(inventoryMovements).values(batch).onConflictDoNothing();
    });
    const stockUpdates = [...inventoryDeltas.entries()].flatMap(([variantId, delta]) => {
      const current = inventoryByVariant.get(variantId);
      if (!current) return [];
      const onHand = current.onHand + delta.onHand;
      const reserved = current.reserved + delta.reserved;
      if (onHand < reserved || reserved < 0) throw new Error(`Generated fixtures exceed stock for variant ${variantId}`);
      return [{ variantId: BigInt(variantId), onHand, reserved }];
    });
    await chunks(stockUpdates, 500, async (batch) => {
      for (const stock of batch) await tx.update(inventories).set({ onHand: stock.onHand, reserved: stock.reserved, updatedAt: new Date() }).where(eq(inventories.variantId, stock.variantId));
    });
  });
  console.log(JSON.stringify({ status: "seeded", targetProducts: 5000, generatedProducts: 4950, categoryCount: allCategories.length, brandCount: brandsToSeed.length, imageRowsPerProduct: 3, orderTarget: 2000, itemTarget: 5000, syntheticCustomers: seedCustomers.length }));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Large seed failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
