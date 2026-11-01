import ExcelJS from "exceljs";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  brands,
  categories,
  products,
  productVariants,
  productImages,
  inventories,
  orders,
  catalogImports,
} from "../../database/schema/index.js";
import { productInput } from "../admin/admin.catalog.schemas.js";
import { createInventoryService } from "../inventory/inventory.service.js";
import { AppError } from "../../shared/errors.js";
import { type Database, jsonValue } from "./common.js";
const columns = [
  "Slug",
  "Tên sản phẩm",
  "Danh mục (slug)",
  "Thương hiệu (slug)",
  "Mô tả",
  "Giá bán",
  "Giá gốc",
  "Trạng thái",
  "Ảnh (ngăn bằng |)",
  "SKU",
  "Tên phiên bản",
  "Giá phiên bản",
  "Tồn thực tế",
];
function workbook(headers: string[]) {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Dữ liệu");
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF5A00" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  headers.forEach((h, i) => {
    sheet.getColumn(i + 1).width = Math.min(45, Math.max(20, h.length + 4));
  });
  return { book, sheet };
}
export function checkWorkbookArchive(buffer: Buffer) {
  // Inspect ZIP central directory before decompression; cap the complete uncompressed workbook.
  let pos = buffer.length - 22;
  for (; pos >= Math.max(0, buffer.length - 65557); pos--)
    if (buffer.readUInt32LE(pos) === 0x06054b50) break;
  if (pos < 0 || buffer.length < 22)
    throw new AppError(400, "INVALID_XLSX", "Tệp không phải Excel .xlsx hợp lệ.");
  const entries = buffer.readUInt16LE(pos + 10),
    start = buffer.readUInt32LE(pos + 16);
  let cursor = start,
    total = 0;
  if (entries > 2048)
    throw new AppError(400, "XLSX_TOO_LARGE", "Tệp Excel có quá nhiều thành phần.");
  for (let i = 0; i < entries; i++) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50)
      throw new AppError(400, "INVALID_XLSX", "Cấu trúc Excel không hợp lệ.");
    total += buffer.readUInt32LE(cursor + 24);
    cursor +=
      46 +
      buffer.readUInt16LE(cursor + 28) +
      buffer.readUInt16LE(cursor + 30) +
      buffer.readUInt16LE(cursor + 32);
  }
  if (total > 32 * 1024 * 1024)
    throw new AppError(400, "XLSX_TOO_LARGE", "Tệp Excel sau giải nén vượt 32 MB.");
}
export function createExcelService(db: Database) {
  async function exportFile(kind: string) {
    const { book, sheet } = workbook(
      kind === "products" || kind === "template"
        ? columns
        : kind === "orders"
          ? [
              "Mã đơn",
              "Khách hàng",
              "Email",
              "Trạng thái",
              "Tạm tính",
              "Giảm giá",
              "Vận chuyển",
              "Tổng tiền",
              "Ngày tạo",
            ]
          : ["SKU", "Sản phẩm", "Phiên bản", "Tồn thực tế", "Đã giữ", "Có thể bán"],
    );
    if (kind === "template") {
      const refs = book.addWorksheet("Danh mục và thương hiệu");
      refs.addRow(["Danh mục", "Slug danh mục", "Thương hiệu", "Slug thương hiệu"]);
      const cats = await db.select().from(categories).orderBy(asc(categories.name)),
        bs = await db.select().from(brands).orderBy(asc(brands.name));
      for (let i = 0; i < Math.max(cats.length, bs.length); i++)
        refs.addRow([cats[i]?.name, cats[i]?.slug, bs[i]?.name, bs[i]?.slug]);
      refs.columns.forEach((c) => {
        c.width = 30;
      });
      const guide = book.addWorksheet("Hướng dẫn");
      [
        "Mỗi dòng là một SKU. Cùng Slug thuộc cùng sản phẩm; tối đa 2.000 dòng/tệp.",
        "Dùng slug danh mục/thương hiệu từ sheet tra cứu; giá VND là số nguyên, không ký tự phân tách.",
        "SKU và slug phải duy nhất. Trạng thái: ACTIVE, INACTIVE, ARCHIVED.",
        "Ảnh: URL https hoặc /images/...; nhiều ảnh ngăn bằng |. Sản phẩm ACTIVE bắt buộc có ảnh.",
        "Tồn thực tế để trống: giữ nguyên; nhập số: điều chỉnh tồn thực tế, không thấp hơn hàng đang giữ.",
        "Nhập cập nhật bảo toàn thông số và SKU không xuất hiện trong tệp. Hãy xuất bản sao trước khi nhập.",
        "Xem trước → xác nhận nhập theo lô. Có thể tiếp tục tác vụ bị ngắt từ danh sách lịch sử.",
      ].forEach((t) => guide.addRow([t]));
      guide.getColumn(1).width = 130;
    } else {
      for (let offset = 0; ; offset += 500) {
        if (kind === "orders") {
          const rows = await db
            .select()
            .from(orders)
            .orderBy(asc(orders.id))
            .limit(500)
            .offset(offset);
          rows.forEach((r) =>
            sheet.addRow([
              r.orderNumber,
              r.shippingFullName,
              r.customerEmail,
              r.status,
              r.subtotal.toString(),
              r.discountAmount.toString(),
              r.shippingFee.toString(),
              r.totalAmount.toString(),
              r.createdAt.toISOString(),
            ]),
          );
          if (rows.length < 500) break;
        } else {
          const rows = await db
            .select({
              p: products,
              v: productVariants,
              c: categories.slug,
              b: brands.slug,
              stock: inventories.onHand,
              reserved: inventories.reserved,
              images: sql<string>`(select string_agg(url,'|' order by sort_order,id) from product_images where product_id=${products.id})`,
            })
            .from(productVariants)
            .innerJoin(products, eq(products.id, productVariants.productId))
            .innerJoin(categories, eq(categories.id, products.categoryId))
            .innerJoin(brands, eq(brands.id, products.brandId))
            .leftJoin(inventories, eq(inventories.variantId, productVariants.id))
            .orderBy(asc(productVariants.id))
            .limit(500)
            .offset(offset);
          rows.forEach(({ p, v, c, b, stock, reserved, images }) =>
            sheet.addRow(
              kind === "products"
                ? [
                    p.slug,
                    p.name,
                    c,
                    b,
                    p.description,
                    p.price,
                    p.compareAtPrice || "",
                    p.status,
                    images,
                    v.sku,
                    v.name,
                    v.price || p.price,
                    stock ?? 0,
                  ]
                : [
                    v.sku,
                    p.name,
                    v.name,
                    stock ?? 0,
                    reserved ?? 0,
                    (stock ?? 0) - (reserved ?? 0),
                  ],
            ),
          );
          if (rows.length < 500) break;
        }
      }
    }
    return book.xlsx.writeBuffer();
  }
  async function preview(buffer: Buffer, filename: string, actorId: number) {
    checkWorkbookArchive(buffer);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as never);
    const sheet = book.getWorksheet("Dữ liệu") || book.worksheets[0];
    if (
      !sheet ||
      sheet.rowCount < 2 ||
      sheet.rowCount > 2001 ||
      columns.some((c, i) => sheet.getRow(1).getCell(i + 1).text !== c)
    )
      throw new AppError(400, "INVALID_IMPORT", "Dùng đúng tệp mẫu, từ 1 đến 2.000 dòng dữ liệu.");
    const cats = await db.select().from(categories),
      bs = await db.select().from(brands);
    const groups = new Map<string, Record<string, unknown>[]>(),
      errors: { row: number; message: string }[] = [],
      seen = new Set<string>();
    for (let n = 2; n <= sheet.rowCount; n++) {
      const r = sheet.getRow(n),
        values = columns.map((_, i) => r.getCell(i + 1).text.trim());
      if (values.every((v) => !v)) continue;
      const [
        slug,
        name,
        cat,
        brand,
        description,
        price,
        compare,
        status,
        images,
        sku,
        variant,
        variantPrice,
        stock,
      ] = values;
      const input = productInput.safeParse({
        slug,
        name,
        description,
        categoryId: cats.find((c) => c.slug === cat)?.id,
        brandId: bs.find((b) => b.slug === brand)?.id.toString(),
        price,
        compareAtPrice: compare || null,
        status,
        images: images
          ?.split("|")
          .filter(Boolean)
          .map((url) => ({ url })),
        variants: [
          {
            sku,
            name: variant,
            price: variantPrice || price,
            initialStock: stock ? Number(stock) : 0,
          },
        ],
      });
      if (!input.success || seen.has(sku!)) {
        errors.push({
          row: n,
          message: seen.has(sku!)
            ? "SKU bị lặp trong tệp."
            : input.success
              ? ""
              : input.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        });
        continue;
      }
      seen.add(sku!);
      const [owner] = await db
        .select({ slug: products.slug })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.sku, sku!));
      if (owner && owner.slug !== slug) {
        errors.push({ row: n, message: "SKU đã thuộc một sản phẩm khác." });
        continue;
      }
      const entry = {
        ...input.data,
        stock: stock === "" ? null : Number(stock),
      } as unknown as Record<string, unknown>;
      const group = groups.get(slug!) || [];
      if (group.length >= 50) { errors.push({row:n,message:"Mỗi sản phẩm hỗ trợ tối đa 50 SKU."}); continue; }
      if (
        group.length &&
        JSON.stringify({ ...group[0], variants: null, stock: null }) !==
          JSON.stringify({ ...entry, variants: null, stock: null })
      ) {
        errors.push({ row: n, message: "Thông tin sản phẩm có cùng slug phải giống nhau." });
        continue;
      }
      group.push(entry);
      groups.set(slug!, group);
    }
    if (errors.length) return { errors, total: sheet.rowCount - 1 };
    const rows = [...groups.values()].map((group) => ({
      product: group[0],
      variants: group.map((g) => ({ variant: (g.variants as unknown[])[0], stock: g.stock })),
    }));
    const [job] = await db
      .insert(catalogImports)
      .values({ actorId, filename: filename.slice(0, 240), rows, total: rows.length })
      .returning();
    return {
      job: jsonValue({ ...job, rows: undefined }),
      errors: [],
      sample: rows.slice(0, 5).map((g) => ({ name: g.product?.name, variants: g.variants.length })),
      total: sheet.rowCount - 1,
    };
  }
  async function listJobs(actorId: number) {
    return jsonValue(
      await db
        .select({
          id: catalogImports.id,
          filename: catalogImports.filename,
          status: catalogImports.status,
          cursor: catalogImports.cursor,
          total: catalogImports.total,
          error: catalogImports.error,
          createdAt: catalogImports.createdAt,
        })
        .from(catalogImports)
        .where(eq(catalogImports.actorId, actorId))
        .orderBy(sql`${catalogImports.id} desc`)
        .limit(20),
    );
  }
  async function runBatch(id: string, actorId: number) {
    // Each product and its checkpoint commit together. Concurrent retries serialize on the job row.
    for (let i = 0; i < 10; i++) {
      const done = await db
        .transaction(async (tx) => {
          const [job] = await tx
            .select()
            .from(catalogImports)
            .where(and(eq(catalogImports.id, BigInt(id)), eq(catalogImports.actorId, actorId)))
            .for("update");
          if (!job) throw new AppError(404, "IMPORT_NOT_FOUND", "Không tìm thấy tác vụ nhập.");
          if (job.cursor >= job.total) return true;
          const entry = job.rows[job.cursor] as {
            product: unknown;
            variants: { variant: unknown; stock: number | null }[];
          };
          const p = productInput.parse(entry.product);
          const [old] = await tx
            .select()
            .from(products)
            .where(eq(products.slug, p.slug))
            .for("update");
          const values = {
            slug: p.slug,
            name: p.name,
            description: p.description,
            categoryId: p.categoryId,
            brandId: BigInt(p.brandId),
            price: p.price,
            compareAtPrice: p.compareAtPrice || null,
            status: p.status,
            updatedAt: new Date(),
          };
          const [saved] = old
            ? await tx.update(products).set(values).where(eq(products.id, old.id)).returning()
            : await tx.insert(products).values(values).returning();
          if (!saved) throw new Error("Không lưu được sản phẩm");
          await tx.delete(productImages).where(eq(productImages.productId, saved.id));
          if (p.images.length)
            await tx
              .insert(productImages)
              .values(
                p.images.map((img, index) => ({
                  productId: saved.id,
                  url: img.url,
                  altText: p.name,
                  sortOrder: index,
                })),
              );
          for (const item of entry.variants) {
            const v = productInput.shape.variants.element.parse(item.variant);
            const [existing] = await tx
              .select()
              .from(productVariants)
              .where(eq(productVariants.sku, v.sku))
              .for("update");
            if (existing && existing.productId !== saved.id)
              throw new AppError(409, "SKU_CONFLICT", "SKU đã thuộc sản phẩm khác.");
            const val = {
              productId: saved.id,
              sku: v.sku,
              name: v.name,
              price: v.price || p.price,
              status: v.status,
            };
            const [variant] = existing
              ? await tx
                  .update(productVariants)
                  .set(val)
                  .where(eq(productVariants.id, existing.id))
                  .returning()
              : await tx.insert(productVariants).values(val).returning();
            if (!variant) throw new Error("Không lưu được SKU");
            await tx
              .insert(inventories)
              .values({ variantId: variant.id, onHand: 0, reserved: 0 })
              .onConflictDoNothing();
            if (item.stock !== null)
              await createInventoryService(db).adjustStock(variant.id, item.stock, {
                transaction: tx,
                idempotencyKey: `import:${job.id}:${job.cursor}:${variant.id}`,
                reference: { type: "catalog-import", id: job.id.toString() },
              });
          }
          await tx
            .update(catalogImports)
            .set({
              cursor: job.cursor + 1,
              status: job.cursor + 1 === job.total ? "COMPLETED" : "RUNNING",
              error: null,
              updatedAt: new Date(),
            })
            .where(eq(catalogImports.id, job.id));
          return false;
        })
        .catch(async (error) => {
          await db
            .update(catalogImports)
            .set({
              status: "FAILED",
              error: String(error instanceof Error ? error.message : error).slice(0, 1000),
            })
            .where(and(eq(catalogImports.id, BigInt(id)), eq(catalogImports.actorId, actorId)));
          throw error;
        });
      if (done) break;
    }
    const [job] = await db
      .select({
        id: catalogImports.id,
        status: catalogImports.status,
        cursor: catalogImports.cursor,
        total: catalogImports.total,
        error: catalogImports.error,
      })
      .from(catalogImports)
      .where(and(eq(catalogImports.id, BigInt(id)), eq(catalogImports.actorId, actorId)));
    return jsonValue(job);
  }
  return { exportFile, preview, listJobs, runBatch };
}
