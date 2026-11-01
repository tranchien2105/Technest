import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import {
  brands,
  categories,
  products,
  productImages,
  productVariants,
  inventories,
} from "../../database/schema/index.js";
import type { ListProductsQuery } from "./catalog.schemas.js";
import { toPublicStock } from "../inventory/inventory.service.js";

type Database = NodePgDatabase<typeof schema>;

function filters(query: ListProductsQuery) {
  const conditions = [eq(products.status, "ACTIVE")];
  if (query.q) {
    const term = `%${query.q}%`;
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(products.description, term),
        ilike(brands.name, term),
        ilike(categories.name, term),
        ilike(categories.nameEn, term),
      )!,
    );
  }
  if (query.category)
    conditions.push(
      sql`${categories.slug} = ${query.category} OR ${categories.parentCategoryId} = (
        SELECT parent.id FROM categories AS parent WHERE parent.slug = ${query.category}
      )`,
    );
  if (query.brand) conditions.push(eq(brands.slug, query.brand.toLowerCase().replaceAll(" ", "-")));
  if (query.minPrice) conditions.push(gte(products.price, query.minPrice));
  if (query.maxPrice) conditions.push(lte(products.price, query.maxPrice));
  if (query.sale === "1")
    conditions.push(
      sql`${products.compareAtPrice} IS NOT NULL AND ${products.compareAtPrice} > ${products.price}`,
    );
  if (query.featured === "1") conditions.push(eq(products.isFeatured, true));
  if (query.trending === "1") conditions.push(eq(products.isTrending, true));
  if (query.ids) conditions.push(inArray(products.id, query.ids.split(",").map(BigInt)));
  return and(...conditions);
}

function orderBy(sort: ListProductsQuery["sort"]) {
  if (sort === "priceLow") return [asc(products.price), asc(products.id)];
  if (sort === "priceHigh") return [desc(products.price), asc(products.id)];
  if (sort === "newest") return [desc(products.createdAt), desc(products.id)];
  if (sort === "recommended")
    return [asc(products.featuredRank), desc(products.createdAt), asc(products.id)];
  return [desc(products.createdAt), asc(products.id)];
}

function serializeProduct(row: {
  id: bigint;
  slug: string;
  name: string;
  description: string;
  price: string;
  compareAtPrice: string | null;
  attributes: Record<string, unknown>;
  badge: string | null;
  isFeatured: boolean;
  isTrending: boolean;
  status: string;
  createdAt: Date;
  brandId: bigint;
  brandName: string;
  brandSlug: string;
  categorySlug: string;
  categoryName: string;
  categoryNameEn: string;
}) {
  return {
    id: row.id.toString(),
    slug: row.slug,
    name: row.name,
    description: row.description,
    brandId: row.brandId.toString(),
    brand: { id: row.brandId.toString(), name: row.brandName, slug: row.brandSlug },
    category: { slug: row.categorySlug, name: row.categoryName, nameEn: row.categoryNameEn },
    price: row.price,
    compareAtPrice: row.compareAtPrice,
    attributes: row.attributes,
    badge: row.badge,
    isFeatured: row.isFeatured,
    isTrending: row.isTrending,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

const productSelect = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  description: products.description,
  price: products.price,
  compareAtPrice: products.compareAtPrice,
  attributes: products.attributes,
  badge: products.badge,
  isFeatured: products.isFeatured,
  isTrending: products.isTrending,
  status: products.status,
  createdAt: products.createdAt,
  brandId: brands.id,
  brandName: brands.name,
  brandSlug: brands.slug,
  categorySlug: categories.slug,
  categoryName: categories.name,
  categoryNameEn: categories.nameEn,
};

export function createCatalogService(db: Database) {
  async function productsList(query: ListProductsQuery) {
    const where = filters(query);
    const offset = (query.page - 1) * query.limit;
    const [rows, totalRows] = await Promise.all([
      db
        .select(productSelect)
        .from(products)
        .innerJoin(brands, eq(products.brandId, brands.id))
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(where)
        .orderBy(...orderBy(query.sort))
        .limit(query.limit)
        .offset(offset),
      db
        .select({ value: count() })
        .from(products)
        .innerJoin(brands, eq(products.brandId, brands.id))
        .innerJoin(categories, eq(products.categoryId, categories.id))
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);
    const ids = rows.map((row) => row.id);
    const [images, variants] = ids.length
      ? await Promise.all([
          db
            .select({
              id: productImages.id,
              productId: productImages.productId,
              variantId: productImages.variantId,
              url: productImages.url,
              altText: productImages.altText,
              sortOrder: productImages.sortOrder,
            })
            .from(productImages)
            .where(inArray(productImages.productId, ids))
            .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
          db
            .select({
              id: productVariants.id,
              productId: productVariants.productId,
              sku: productVariants.sku,
              name: productVariants.name,
              price: productVariants.price,
              compareAtPrice: productVariants.compareAtPrice,
              attributes: productVariants.attributes,
              status: productVariants.status,
            })
            .from(productVariants)
            .where(
              and(inArray(productVariants.productId, ids), eq(productVariants.status, "ACTIVE")),
            )
            .orderBy(asc(productVariants.id)),
        ])
      : [[], []];
    const inventoryRows = variants.length
      ? await db
          .select()
          .from(inventories)
          .where(
            inArray(
              inventories.variantId,
              variants.map((variant) => variant.id),
            ),
          )
      : [];
    const inventoryByVariant = new Map(inventoryRows.map((row) => [row.variantId.toString(), row]));
    const imagesByProduct = new Map<string, typeof images>();
    for (const image of images)
      imagesByProduct.set(image.productId.toString(), [
        ...(imagesByProduct.get(image.productId.toString()) || []),
        image,
      ]);
    const variantsByProduct = new Map<string, typeof variants>();
    for (const variant of variants)
      variantsByProduct.set(variant.productId.toString(), [
        ...(variantsByProduct.get(variant.productId.toString()) || []),
        variant,
      ]);
    return {
      items: rows.map((row) => {
        const productVariants = variantsByProduct.get(row.id.toString()) || [];
        const variantsWithStock = productVariants.map((variant) => ({
          id: variant.id.toString(),
          sku: variant.sku,
          name: variant.name,
          price: variant.price,
          compareAtPrice: variant.compareAtPrice,
          attributes: variant.attributes,
          status: variant.status,
          ...toPublicStock(variant.id, inventoryByVariant.get(variant.id.toString())),
        }));
        const defaultVariantStock = variantsWithStock[0];
        return {
          ...serializeProduct(row),
          availableQuantity: defaultVariantStock?.availableQuantity ?? null,
          inStock: defaultVariantStock?.inStock ?? null,
          stockStatus: defaultVariantStock?.stockStatus ?? "UNKNOWN",
          images: (imagesByProduct.get(row.id.toString()) || []).map((image) => ({
            id: image.id.toString(),
            variantId: image.variantId?.toString() || null,
            url: image.url,
            altText: image.altText,
            sortOrder: image.sortOrder,
          })),
          variants: variantsWithStock,
        };
      }),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async function productById(id: string) {
    const [row] = await db
      .select(productSelect)
      .from(products)
      .innerJoin(brands, eq(products.brandId, brands.id))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(and(eq(products.id, BigInt(id)), eq(products.status, "ACTIVE")))
      .limit(1);
    if (!row) return null;
    const [images, variants] = await Promise.all([
      db
        .select({
          id: productImages.id,
          variantId: productImages.variantId,
          url: productImages.url,
          altText: productImages.altText,
          sortOrder: productImages.sortOrder,
        })
        .from(productImages)
        .where(eq(productImages.productId, BigInt(id)))
        .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
      db
        .select({
          id: productVariants.id,
          sku: productVariants.sku,
          name: productVariants.name,
          price: productVariants.price,
          compareAtPrice: productVariants.compareAtPrice,
          attributes: productVariants.attributes,
          status: productVariants.status,
        })
        .from(productVariants)
        .where(and(eq(productVariants.productId, BigInt(id)), eq(productVariants.status, "ACTIVE")))
        .orderBy(asc(productVariants.id)),
    ]);
    const inventoryRows = variants.length
      ? await db
          .select()
          .from(inventories)
          .where(
            inArray(
              inventories.variantId,
              variants.map((variant) => variant.id),
            ),
          )
      : [];
    const inventoryByVariant = new Map(
      inventoryRows.map((inventory) => [inventory.variantId.toString(), inventory]),
    );
    const variantsWithStock = variants.map((variant) => ({
      ...variant,
      id: variant.id.toString(),
      ...toPublicStock(variant.id, inventoryByVariant.get(variant.id.toString())),
    }));
    const defaultVariantStock = variantsWithStock[0];
    return {
      ...serializeProduct(row),
      availableQuantity: defaultVariantStock?.availableQuantity ?? null,
      inStock: defaultVariantStock?.inStock ?? null,
      stockStatus: defaultVariantStock?.stockStatus ?? "UNKNOWN",
      images: images.map((image) => ({
        ...image,
        id: image.id.toString(),
        variantId: image.variantId?.toString() || null,
      })),
      variants: variantsWithStock,
    };
  }

  async function categoriesList() {
    const rows = await db
      .select({
        id: categories.slug,
        name: categories.name,
        nameEn: categories.nameEn,
        uuid: categories.id,
        parentId: categories.parentCategoryId,
      })
      .from(categories)
      .orderBy(asc(categories.name));
    return rows
      .filter((category) => !category.parentId)
      .map((category) => ({
        id: category.id,
        name: category.name,
        nameEn: category.nameEn,
        children: rows
          .filter((child) => child.parentId?.toString() === category.uuid)
          .map(({ id, name, nameEn }) => ({ id, name, nameEn })),
      }));
  }

  async function brandsList() {
    return db
      .select({ id: brands.slug, name: brands.name })
      .from(brands)
      .innerJoin(products, eq(products.brandId, brands.id))
      .where(eq(products.status, "ACTIVE"))
      .groupBy(brands.id, brands.slug, brands.name)
      .orderBy(asc(brands.name));
  }

  return { productsList, productById, categoriesList, brandsList };
}
