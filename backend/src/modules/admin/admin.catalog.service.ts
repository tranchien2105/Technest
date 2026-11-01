import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, ilike, notInArray, or, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { alias } from "drizzle-orm/pg-core";
import * as schema from "../../database/schema/index.js";
import { brands, categories, inventories, inventoryMovements, productImages, productVariants, products, users, orders } from "../../database/schema/index.js";
import { AppError } from "../../shared/errors.js";
import { insertNotification } from "../notifications/notifications.service.js";

type Database = NodePgDatabase<typeof schema>;
type ProductInput = {
  slug: string; name: string; description: string; categoryId: string; brandId: string; price: string;
  compareAtPrice?: string | null; status: "ACTIVE" | "INACTIVE" | "ARCHIVED"; badge?: string | null;
  isFeatured: boolean; isTrending: boolean; attributes: Record<string, unknown>; compatibleWith: string[];
  images: { url: string; altText?: string }[];
  variants: {
    id?: string; sku: string; name: string; price?: string; compareAtPrice?: string | null;
    status: "ACTIVE" | "INACTIVE" | "ARCHIVED"; attributes: Record<string, unknown>; initialStock: number
  }[];
};
type PageInput = { page: number; limit: number; q?: string; status?: string; usage?: "used" | "unused"; level?: "root" | "child" };
type ProductListInput = PageInput & { categoryId?: string; brandId?: string; stock?: "in" | "low" | "out"; minPrice?: number; maxPrice?: number; sort?: "newest" | "oldest" | "name" | "priceAsc" | "priceDesc" };

function positiveBigint(value: string) {
  try {
    const result = BigInt(value);
    if (result > 0n && result <= 9_223_372_036_854_775_807n) return result;
  } catch { /* handled below */ }
  throw new AppError(400, "INVALID_ID", "A valid positive ID is required");
}

export function createAdminCatalogService(db: Database) {
  const parentCategory = alias(categories, "parent_category");
  async function productList(input: ProductListInput) {
    const offset = (input.page - 1) * input.limit;
    const available = sql<number>`coalesce((select sum(i.on_hand - i.reserved) from inventories i
      join product_variants pv on pv.id = i.variant_id where pv.product_id = ${products.id} and pv.status = 'ACTIVE'), 0)`;
    const where = and(
      input.status ? eq(products.status, input.status as "ACTIVE" | "INACTIVE" | "ARCHIVED") : undefined,
      input.categoryId ? sql`${products.categoryId} in (
        with recursive catalog_tree as (
          select c.id from categories c where c.id = ${input.categoryId}::uuid
          union select c.id from categories c join catalog_tree t on c.parent_category_id = t.id
        ) select id from catalog_tree
      )` : undefined,
      input.brandId ? eq(products.brandId, positiveBigint(input.brandId)) : undefined,
      input.minPrice !== undefined ? sql`${products.price} >= ${String(input.minPrice)}` : undefined,
      input.maxPrice !== undefined ? sql`${products.price} <= ${String(input.maxPrice)}` : undefined,
      input.stock === "out" ? sql`${available} <= 0` : input.stock === "low" ? sql`${available} > 0 and ${available} <= 5` : input.stock === "in" ? sql`${available} > 0` : undefined,
      input.q ? or(ilike(products.name, `%${input.q}%`), ilike(products.slug, `%${input.q}%`), ilike(brands.name, `%${input.q}%`),
        sql`exists (select 1 from product_variants pv where pv.product_id = ${products.id} and pv.sku ilike ${`%${input.q}%`})`) : undefined,
    );
    const sort = input.sort === "name" ? asc(products.name) : input.sort === "oldest" ? asc(products.createdAt)
      : input.sort === "priceAsc" ? asc(products.price) : input.sort === "priceDesc" ? desc(products.price) : desc(products.createdAt);
    const [rows, countRows] = await Promise.all([
      db.select({
        id: products.id, name: products.name, slug: products.slug, price: products.price, status: products.status,
        brand: brands.name, category: categories.name, available,
        image: sql<string | null>`(select pi.url from product_images pi where pi.product_id = ${products.id} order by (pi.variant_id is not null), pi.sort_order, pi.id limit 1)`,
        skuCount: sql<number>`(select count(*) from product_variants pv where pv.product_id = ${products.id})`
      })
        .from(products).innerJoin(brands, eq(products.brandId, brands.id)).innerJoin(categories, eq(products.categoryId, categories.id))
        .where(where).orderBy(sort, desc(products.id)).limit(input.limit).offset(offset),
      db.select({ value: count() }).from(products).innerJoin(brands, eq(products.brandId, brands.id)).where(where),
    ]);
    const total = Number(countRows[0]?.value ?? 0);
    return { items: rows.map((row) => ({ ...row, id: row.id.toString(), price: row.price.toString(), available: Number(row.available), skuCount: Number(row.skuCount) })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async function productDetail(idValue: string) {
    const id = positiveBigint(idValue);
    const [row] = await db.select({ product: products, brand: brands.name, category: categories.name })
      .from(products).innerJoin(brands, eq(products.brandId, brands.id)).innerJoin(categories, eq(products.categoryId, categories.id))
      .where(eq(products.id, id)).limit(1);
    if (!row) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
    const [images, variants] = await Promise.all([
      db.select().from(productImages).where(eq(productImages.productId, id)).orderBy(asc(productImages.sortOrder), asc(productImages.id)),
      db.select({ variant: productVariants, onHand: inventories.onHand, reserved: inventories.reserved })
        .from(productVariants).leftJoin(inventories, eq(inventories.variantId, productVariants.id))
        .where(eq(productVariants.productId, id)).orderBy(asc(productVariants.id)),
    ]);
    const product = row.product;
    return {
      ...product, id: id.toString(), brandId: product.brandId.toString(), price: product.price.toString(), compareAtPrice: product.compareAtPrice?.toString() ?? null,
      brand: row.brand, category: row.category, images: images.map((image) => ({ ...image, id: image.id.toString(), productId: image.productId.toString(), variantId: image.variantId?.toString() ?? null })), variants: variants.map(({ variant, onHand, reserved }) => ({
        ...variant,
        id: variant.id.toString(), productId: variant.productId.toString(), price: variant.price?.toString() ?? null, compareAtPrice: variant.compareAtPrice?.toString() ?? null,
        onHand: onHand ?? 0, reserved: reserved ?? 0, available: (onHand ?? 0) - (reserved ?? 0)
      }))
    };
  }

  async function saveProduct(input: ProductInput, idValue?: string) {
    const id = idValue ? positiveBigint(idValue) : undefined;
    let savedId = id;
    const brandId = positiveBigint(input.brandId);
    await db.transaction(async (tx) => {
      const [brand] = await tx.select({ id: brands.id }).from(brands).where(eq(brands.id, brandId)).limit(1);
      const [category] = await tx.select({ id: categories.id }).from(categories).where(eq(categories.id, input.categoryId)).limit(1);
      if (!brand || !category) throw new AppError(400, "INVALID_CATALOG_REFERENCE", "Select an existing brand and category");
      if (id) {
        const [existing] = await tx.select({ id: products.id }).from(products).where(eq(products.id, id)).limit(1);
        if (!existing) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
      }
      const values = {
        slug: input.slug, name: input.name, description: input.description, categoryId: input.categoryId,
        brandId, price: input.price, compareAtPrice: input.compareAtPrice ?? null, status: input.status,
        badge: input.badge ?? null, isFeatured: input.isFeatured, isTrending: input.isTrending,
        attributes: input.attributes, compatibleWith: input.compatibleWith, updatedAt: new Date()
      };
      let productId = id;
      if (productId) {
        await tx.update(products).set(values).where(eq(products.id, productId));
      } else {
        const [created] = await tx.insert(products).values(values).returning({ id: products.id });
        if (!created) throw new AppError(500, "PRODUCT_SAVE_FAILED", "Product could not be saved");
        productId = created.id;
        savedId = created.id;
      }
      if (!productId) throw new AppError(500, "PRODUCT_SAVE_FAILED", "Product could not be saved");

      await tx.delete(productImages).where(eq(productImages.productId, productId));
      if (input.images.length) await tx.insert(productImages).values(input.images.map((image, index) => ({ productId: productId!, url: image.url, altText: image.altText ?? input.name, sortOrder: index })));

      const retainedVariantIds: bigint[] = [];
      for (const variant of input.variants) {
        let variantId: bigint;
        if (variant.id) {
          variantId = positiveBigint(variant.id);
          const [existing] = await tx.select({ id: productVariants.id }).from(productVariants)
            .where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId))).limit(1);
          if (!existing) throw new AppError(400, "INVALID_VARIANT", "Variant does not belong to this product");
          await tx.update(productVariants).set({
            sku: variant.sku, name: variant.name, price: variant.price ?? null,
            compareAtPrice: variant.compareAtPrice ?? null, status: variant.status, attributes: variant.attributes
          }).where(eq(productVariants.id, variantId));
        } else {
          const [created] = await tx.insert(productVariants).values({
            productId, sku: variant.sku, name: variant.name,
            price: variant.price ?? input.price, compareAtPrice: variant.compareAtPrice ?? null,
            status: variant.status, attributes: variant.attributes
          }).returning({ id: productVariants.id });
          if (!created) throw new AppError(500, "VARIANT_SAVE_FAILED", "Product variant could not be saved");
          variantId = created.id;
          await tx.insert(inventories).values({ variantId, onHand: variant.initialStock, reserved: 0 });
          if (variant.initialStock > 0) await tx.insert(inventoryMovements).values({
            variantId, type: "INBOUND", quantity: variant.initialStock,
            idempotencyKey: `admin-product-create:${randomUUID()}`, metadata: { source: "admin-product-create" }
          });
        }
        retainedVariantIds.push(variantId);
      }
      if (id) {
        const retainedIds = retainedVariantIds;
        if (retainedIds.length) await tx.update(productVariants).set({ status: "INACTIVE" })
          .where(and(eq(productVariants.productId, productId), notInArray(productVariants.id, retainedIds)));
        else await tx.update(productVariants).set({ status: "INACTIVE" }).where(eq(productVariants.productId, productId));
      }
    });
    if (!savedId) throw new AppError(500, "PRODUCT_SAVE_FAILED", "Product could not be saved");
    return productDetail(savedId.toString());
  }

  async function productArchive(idValue: string) {
    const id = positiveBigint(idValue);
    await db.transaction(async (tx) => {
      const [row] = await tx.update(products).set({ status: "ARCHIVED", updatedAt: new Date() }).where(eq(products.id, id)).returning({ id: products.id });
      if (!row) throw new AppError(404, "PRODUCT_NOT_FOUND", "Product not found");
      await tx.update(productVariants).set({ status: "ARCHIVED" }).where(eq(productVariants.productId, id));
      return row;
    });
    return { id: id.toString(), status: "ARCHIVED" };
  }

  async function brandList(input: PageInput) {
    const hasProducts = sql`exists (select 1 from products p where p.brand_id = ${brands.id})`;
    const where = and(input.q ? or(ilike(brands.name, `%${input.q}%`), ilike(brands.slug, `%${input.q}%`)) : undefined,
      input.usage === "used" ? hasProducts : input.usage === "unused" ? sql`not ${hasProducts}` : undefined);
    const [items, totalRows] = await Promise.all([
      db.select({ id: brands.id, name: brands.name, slug: brands.slug, createdAt: brands.createdAt, productCount: sql<number>`count(${products.id})` })
        .from(brands).leftJoin(products, eq(products.brandId, brands.id)).where(where).groupBy(brands.id).orderBy(asc(brands.name)).limit(input.limit).offset((input.page - 1) * input.limit),
      db.select({ value: count() }).from(brands).where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);
    return { items: items.map((item) => ({ ...item, id: item.id.toString(), productCount: Number(item.productCount) })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async function saveBrand(input: { name: string; slug: string }, idValue?: string) {
    if (idValue) {
      const id = positiveBigint(idValue);
      const [row] = await db.update(brands).set(input).where(eq(brands.id, id)).returning({ id: brands.id });
      if (!row) throw new AppError(404, "BRAND_NOT_FOUND", "Brand not found");
      return { ...input, id: row.id.toString() };
    }
    const [row] = await db.insert(brands).values(input).returning({ id: brands.id });
    if (!row) throw new AppError(500, "BRAND_SAVE_FAILED", "Brand could not be saved");
    return { ...input, id: row.id.toString() };
  }

  async function removeBrand(idValue: string) {
    const id = positiveBigint(idValue);
    const [used] = await db.select({ value: count() }).from(products).where(eq(products.brandId, id));
    if (Number(used?.value ?? 0) > 0) throw new AppError(409, "BRAND_IN_USE", "Brand has products; archive or reassign those products first");
    const [removed] = await db.delete(brands).where(eq(brands.id, id)).returning({ id: brands.id });
    if (!removed) throw new AppError(404, "BRAND_NOT_FOUND", "Brand not found");
    return { id: id.toString(), deleted: true };
  }

  async function categoryList(input: PageInput) {
    const hasProducts = sql`exists (select 1 from products p where p.category_id = ${categories.id})`;
    const where = and(input.q ? or(ilike(categories.name, `%${input.q}%`), ilike(categories.nameEn, `%${input.q}%`), ilike(categories.slug, `%${input.q}%`)) : undefined,
      input.usage === "used" ? hasProducts : input.usage === "unused" ? sql`not ${hasProducts}` : undefined,
      input.level === "root" ? sql`${categories.parentCategoryId} is null` : input.level === "child" ? sql`${categories.parentCategoryId} is not null` : undefined);
    const [items, totalRows] = await Promise.all([
      db.select({
        id: categories.id, name: categories.name, nameEn: categories.nameEn, slug: categories.slug, parentCategoryId: categories.parentCategoryId,
        parentName: parentCategory.name, productCount: sql<number>`count(distinct ${products.id})`
      })
        .from(categories).leftJoin(parentCategory, eq(parentCategory.id, categories.parentCategoryId))
        .leftJoin(products, eq(products.categoryId, categories.id)).where(where).groupBy(categories.id, parentCategory.name).orderBy(asc(categories.name)).limit(input.limit).offset((input.page - 1) * input.limit),
      db.select({ value: count() }).from(categories).where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);
    return { items: items.map((item) => ({ ...item, productCount: Number(item.productCount) })), pagination: { page: input.page, limit: input.limit, total, totalPages: Math.ceil(total / input.limit) } };
  }

  async function saveCategory(input: { name: string; nameEn: string; slug: string; parentCategoryId?: string | null }, idValue?: string) {
    if (idValue && input.parentCategoryId === idValue) throw new AppError(400, "INVALID_PARENT", "A category cannot be its own parent");
    if (input.parentCategoryId) {
      const [parentExists] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, input.parentCategoryId)).limit(1);
      if (!parentExists) throw new AppError(400, "INVALID_PARENT", "Parent category does not exist");
      let cursor: string | null = input.parentCategoryId;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        if (cursor === idValue) throw new AppError(400, "INVALID_PARENT", "A category cannot be moved beneath one of its descendants");
        seen.add(cursor);
        const [parent] = await db.select({ parentCategoryId: categories.parentCategoryId }).from(categories).where(eq(categories.id, cursor)).limit(1);
        cursor = parent?.parentCategoryId ?? null;
      }
    }
    const values = { ...input, parentCategoryId: input.parentCategoryId ?? null, updatedAt: new Date() };
    if (idValue) {
      const [row] = await db.update(categories).set(values).where(eq(categories.id, idValue)).returning({ id: categories.id });
      if (!row) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
      return { ...values, id: row.id };
    }
    const [row] = await db.insert(categories).values(values).returning({ id: categories.id });
    if (!row) throw new AppError(500, "CATEGORY_SAVE_FAILED", "Category could not be saved");
    return { ...values, id: row.id };
  }

  async function removeCategory(id: string) {
    const [used] = await db.select({ value: count() }).from(products).where(eq(products.categoryId, id));
    const [children] = await db.select({ value: count() }).from(categories).where(eq(categories.parentCategoryId, id));
    if (Number(used?.value ?? 0) || Number(children?.value ?? 0)) throw new AppError(409, "CATEGORY_IN_USE", "Category has products or child categories; reassign them first");
    const [removed] = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
    if (!removed) throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
    return { id, deleted: true };
  }

  async function customerDetail(idValue: string) {
    const id = positiveBigint(idValue);
    const [customer] = await db.select({ id: users.id, email: users.email, fullName: users.fullName, phone: users.phone, status: users.status, createdAt: users.createdAt })
      .from(users).where(and(eq(users.id, Number(id)), eq(users.role, "CUSTOMER"))).limit(1);
    if (!customer) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
    const [summary] = await db.select({ orders: count(orders.id), spent: sql<string>`coalesce(sum(${orders.totalAmount}) filter (where ${orders.status} = 'DELIVERED'), 0)::text` })
      .from(orders).where(eq(orders.userId, id));
    const recentOrders = await db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status, totalAmount: orders.totalAmount, createdAt: orders.createdAt })
      .from(orders).where(eq(orders.userId, id)).orderBy(desc(orders.createdAt)).limit(10);
    return {
      ...customer, id: customer.id.toString(), createdAt: customer.createdAt.toISOString(), orderCount: Number(summary?.orders ?? 0),
      totalSpent: summary?.spent ?? "0", recentOrders: recentOrders.map((order) => ({ ...order, id: order.id.toString(), totalAmount: order.totalAmount.toString(), createdAt: order.createdAt.toISOString() }))
    };
  }

  async function setCustomerStatus(idValue: string, status: "ACTIVE" | "BLOCKED") {
    const id = positiveBigint(idValue);
    return db.transaction(async (tx) => {
      const [current] = await tx.select({ id: users.id, status: users.status }).from(users).where(and(eq(users.id, Number(id)), eq(users.role, "CUSTOMER"))).for("update").limit(1);
      if (!current) throw new AppError(404, "CUSTOMER_NOT_FOUND", "Customer not found");
      if (current.status === status) return { id: current.id.toString(), status: current.status, notification: null };
      const [updated] = await tx.update(users).set({ status, updatedAt: new Date() }).where(eq(users.id, current.id)).returning({ id: users.id, status: users.status });
      const notification = status === "BLOCKED" ? await insertNotification(tx, { recipientUserId: current.id, type: "ACCOUNT_LOCKED", title: "Tài khoản tạm thời bị khóa", message: "Tài khoản Technest của bạn hiện đã bị khóa. Vui lòng liên hệ bộ phận hỗ trợ để được trợ giúp.", entityType: "ACCOUNT", entityId: current.id.toString(), targetUrl: "/account/security", eventKey: `account:${current.id}:locked:${Date.now()}` }) : null;
      return { id: updated!.id.toString(), status: updated!.status, notification };
    });
  }

  return { productList, productDetail, saveProduct, productArchive, brandList, saveBrand, removeBrand, categoryList, saveCategory, removeCategory, customerDetail, setCustomerStatus };
}

export type AdminCatalogService = ReturnType<typeof createAdminCatalogService>;
