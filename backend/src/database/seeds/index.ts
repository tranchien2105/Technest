import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { asc, eq } from "drizzle-orm";
import { loadEnv } from "../../config/env.js";
import { createDatabase } from "../../config/database.js";
import { createLogger } from "../../config/logger.js";
import {
  brands,
  categories,
  inventories,
  productImages,
  products,
  productVariants,
} from "../schema/index.js";

interface SeedProduct {
  sourceId: number;
  createdAt: string;
  name: string;
  brand: string;
  category: string;
  price: string;
  compareAtPrice: string | null;
  description: string;
  image: string;
  badge: string;
  compatibleWith: string[];
  isFeatured: boolean;
  isTrending: boolean;
}

const env = loadEnv();
if (env.NODE_ENV === "production") throw new Error("Demo seeds are disabled in production");
const logger = createLogger(env.LOG_LEVEL);
const { db, pool } = createDatabase(env.DATABASE_URL);
const seedProducts = JSON.parse(
  await readFile(fileURLToPath(new URL("./products.json", import.meta.url)), "utf8"),
) as SeedProduct[];
const categoryLabels: Record<string, { name: string; nameEn: string }> = {
  keyboards: { name: "Bàn phím", nameEn: "Keyboards" },
  mice: { name: "Chuột", nameEn: "Mice" },
  monitors: { name: "Màn hình", nameEn: "Monitors" },
  audio: { name: "Tai nghe", nameEn: "Audio" },
  accessories: { name: "Phụ kiện", nameEn: "Accessories" },
};
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

try {
  await db.transaction(async (tx) => {
    for (const [slug, labels] of Object.entries(categoryLabels)) {
      await tx
        .insert(categories)
        .values({ slug, ...labels })
        .onConflictDoUpdate({
          target: categories.slug,
          set: labels,
        });
    }
    const categoryRows = await tx.select().from(categories);
    const categoryIds = new Map(categoryRows.map((category) => [category.slug, category.id]));
    const brandNames = [...new Set(seedProducts.map((product) => product.brand))];
    for (const name of brandNames) {
      await tx
        .insert(brands)
        .values({ name, slug: slugify(name) })
        .onConflictDoNothing();
    }
    const brandRows = await tx.select().from(brands);
    const brandIds = new Map(brandRows.map((brand) => [brand.name, brand.id]));
    const sortedFeatured = seedProducts.filter((product) => product.isFeatured);
    const sortedTrending = seedProducts.filter((product) => product.isTrending);
    for (const product of seedProducts) {
      const categoryId = categoryIds.get(product.category);
      const brandId = brandIds.get(product.brand);
      if (!categoryId || !brandId)
        throw new Error("Catalog seed references an unknown category or brand");
      const slug = slugify(product.name);
      const featuredRank = sortedFeatured.findIndex((item) => item.name === product.name);
      const trendingRank = sortedTrending.findIndex((item) => item.name === product.name);
      const [saved] = await tx
        .insert(products)
        .values({
          slug,
          name: product.name,
          description: product.description,
          categoryId,
          brandId,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          badge: product.badge,
          compatibleWith: product.compatibleWith,
          isFeatured: product.isFeatured,
          featuredRank: featuredRank < 0 ? null : featuredRank,
          isTrending: product.isTrending,
          trendingRank: trendingRank < 0 ? null : trendingRank,
          status: "ACTIVE",
          createdAt: new Date(product.createdAt),
        })
        .onConflictDoUpdate({
          target: products.slug,
          set: {
            name: product.name,
            description: product.description,
            categoryId,
            brandId,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            badge: product.badge,
            compatibleWith: product.compatibleWith,
            isFeatured: product.isFeatured,
            featuredRank: featuredRank < 0 ? null : featuredRank,
            isTrending: product.isTrending,
            trendingRank: trendingRank < 0 ? null : trendingRank,
            status: "ACTIVE",
            createdAt: new Date(product.createdAt),
          },
        })
        .returning({ id: products.id });
      const productId = saved!.id;
      const [variant] = await tx
        .insert(productVariants)
        .values({
          productId,
          sku: `TN-${productId}-STD`,
          name: "Standard",
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          status: "ACTIVE",
        })
        .onConflictDoUpdate({
          target: productVariants.sku,
          set: {
            productId,
            price: product.price,
            compareAtPrice: product.compareAtPrice,
            status: "ACTIVE",
          },
        })
        .returning({ id: productVariants.id });
      await tx
        .insert(inventories)
        .values({ variantId: variant!.id, onHand: 15 + (product.sourceId % 20), reserved: 0 })
        .onConflictDoNothing({ target: inventories.variantId });
      const existingImages = await tx
        .select({ id: productImages.id })
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .orderBy(asc(productImages.sortOrder));
      if (existingImages.length === 0) {
        await tx.insert(productImages).values({
          productId,
          variantId: variant!.id,
          url: product.image,
          altText: product.name,
          sortOrder: 0,
        });
      }
    }
  });
  logger.info({ products: seedProducts.length }, "Development catalog seeded");
} catch {
  logger.error("Catalog seeding failed");
  process.exitCode = 1;
} finally {
  await pool.end();
}
