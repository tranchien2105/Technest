import { describe, it, expect } from "vitest";
import request from "supertest";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import ExcelJS from "exceljs";
import { unlink } from "node:fs/promises";
import { createDatabase } from "../src/config/database.js";
import { loadEnv } from "../src/config/env.js";
import * as s from "../src/database/schema/index.js";
import { createOperationsService } from "../src/modules/admin-operations/operations.service.js";
import { createExcelService } from "../src/modules/admin-operations/excel.service.js";
import { createOrdersService } from "../src/modules/orders/orders.service.js";
import { createApp } from "../src/app.js";
import { createLogger } from "../src/config/logger.js";
import type { AuthService } from "../src/modules/auth/auth.service.js";
import type { Database } from "../src/modules/admin-operations/common.js";
import { uploadDirectory } from "../src/modules/admin-operations/uploads.js";
describe.skipIf(process.env.RUN_ADMIN_OPS_DB_TESTS !== "1")(
  "Admin operational transactions",
  () => {
    it("validates new workflows using rollback fixtures and no real email delivery", async () => {
      const env = loadEnv();
      if (env.NODE_ENV === "production") throw new Error("Development database required");
      const { db, pool } = createDatabase(env.DATABASE_URL);
      const stop = new Error("rollback");
      try {
        await db.transaction(async (tx) => {
          const database = tx as unknown as Database,
            ops = createOperationsService(database),
            excel = createExcelService(database),
            orders = createOrdersService(database),
            key = crypto.randomUUID();
          const [cat] = await tx.select().from(s.categories).limit(1),
            [brand] = await tx.select().from(s.brands).limit(1);
          const [user] = await tx
            .insert(s.users)
            .values({
              email: `ops-${key}@example.test`,
              passwordHash: "fixture",
              role: "ADMIN",
              fullName: "Fixture",
            })
            .returning();
          const staff = await ops.saveStaff({email:`staff-${key}@example.test`, fullName:"Nhân viên kiểm thử", password:"FixturePassword!92", status:"ACTIVE", permissions:["products:read"]}, user!.id);
          const [storedStaff] = await tx.select().from(s.users).where(eq(s.users.id, Number(staff.id)));
          expect(storedStaff!.role).toBe("STAFF"); expect(storedStaff!.permissions).toEqual(["products:read"]); expect(storedStaff!.passwordHash).not.toBe("FixturePassword!92");
          await ops.saveStaff({email:storedStaff!.email,fullName:storedStaff!.fullName!,status:"BLOCKED",permissions:[]},user!.id,staff.id);
          expect((await tx.select().from(s.users).where(eq(s.users.id,Number(staff.id))))[0]!.status).toBe("BLOCKED");
          const [p] = await tx
            .insert(s.products)
            .values({
              slug: `ops-${key}`,
              name: "Operations fixture",
              price: "100001",
              categoryId: cat!.id,
              brandId: brand!.id,
            })
            .returning();
          const [v] = await tx
            .insert(s.productVariants)
            .values({ productId: p!.id, sku: `OPS-${key}`, name: "Fixture", price: "100001" })
            .returning();
          await tx.insert(s.inventories).values({ variantId: v!.id, onHand: 10, reserved: 0 });
          await tx
            .insert(s.productImages)
            .values({ productId: p!.id, url: "/images/technest-product-placeholder.svg" });
          const code = `OPS${key.replaceAll("-", "").slice(0, 12).toUpperCase()}`;
          await ops.saveVoucher({
            code,
            name: "Fixture",
            type: "PERCENT",
            value: "10",
            minSubtotal: "0",
            maxDiscount: "20000",
            usageLimit: 1,
            perUserLimit: 1,
            startsAt: new Date(Date.now() - 60000).toISOString(),
            endsAt: new Date(Date.now() + 86400000).toISOString(),
            active: true,
          });
          const body = {
            items: [{ variantId: v!.id.toString(), quantity: 1 }],
            shippingAddress: {
              fullName: "Fixture",
              phone: "0901234567",
              address: "Test",
              city: "Hà Nội",
            },
            paymentMethod: "COD" as const,
            voucherCode: code,
            idempotencyKey: key,
          };
          expect((await orders.preview(body, user!.id)).discountAmount).toBe("10000");
          const placed = (await orders.create(body, user!)).order!;
          expect((await orders.create(body, user!)).replayed).toBe(true);
          await expect(orders.preview(body, user!.id)).rejects.toThrow();
          await orders.transition(placed.id, "CANCELLED", user!.id);
          await orders.transition(placed.id, "CANCELLED", user!.id);
          expect((await orders.preview(body, user!.id)).discountAmount).toBe("10000");
          const bulk = {
            ids: [p!.id.toString()],
            key,
            action: "PRICE" as const,
            price: "10",
            priceMode: "INCREASE_PERCENT" as const,
            includeVariants: true,
          };
          await ops.bulk(bulk, user!.id);
          await ops.bulk(bulk, user!.id);
          expect(
            (await tx.select().from(s.products).where(eq(s.products.id, p!.id)))[0]!.price,
          ).toBe("110001");
          const banner = await ops.saveBanner({
            title: "Scheduled fixture",
            subtitle: "",
            imageUrl: "/images/technest-product-placeholder.svg",
            link: "/products",
            buttonText: "Xem",
            position: "HOME_PROMO",
            sortOrder: 1,
            active: true,
            startsAt: new Date(Date.now() + 86400000).toISOString(),
            endsAt: null,
          });
          expect((await ops.publicBanners()).some((b) => String(b.id) === String(banner.id))).toBe(
            false,
          );
          const auth = {
            authenticate: async (token?: string) =>
              token === "readonly"
                ? { ...user!, role: "STAFF", permissions: ["products:read"] }
                : token === "staff"
                  ? { ...user!, role: "STAFF", permissions: ["products:write"] }
                  : user!,
          } as unknown as AuthService;
          const app = createApp({
            logger: createLogger("silent"),
            corsOrigin: "http://localhost:5173",
            health: { postgres: async () => 1, redis: async () => "PONG" },
            admin: { db: database, auth },
          });
          await request(app)
            .post("/api/v1/admin/products/bulk")
            .set("Authorization", "Bearer readonly")
            .send(bulk)
            .expect(403);
          await request(app)
            .post("/api/v1/admin/staff")
            .set("Authorization", "Bearer staff")
            .send({})
            .expect(403);
          await request(app)
            .get("/api/v1/admin/products/references")
            .set("Authorization", "Bearer staff")
            .expect(200);
          const img = await request(app)
            .post("/api/v1/admin/uploads")
            .set("Authorization", "Bearer staff")
            .attach(
              "images",
              await sharp({ create: { width: 20, height: 20, channels: 3, background: "#ff5a00" } })
                .png()
                .toBuffer(),
              "fixture.png",
            )
            .expect(201);
          const url = img.body.data[0].url;
          await request(app).get(url).expect(200);
          await unlink(`${uploadDirectory}${url.split("/").pop()}`);
          await request(app)
            .post("/api/v1/admin/uploads")
            .set("Authorization", "Bearer staff")
            .attach("images", Buffer.from("<svg/>"), "bad.svg")
            .expect(400);
          const book = new ExcelJS.Workbook();
          await book.xlsx.load((await excel.exportFile("template")) as never);
          book
            .getWorksheet("Dữ liệu")!
            .addRow([
              `import-${key}`,
              "Sản phẩm nhập thử",
              cat!.slug,
              brand!.slug,
              "Mô tả nhập thử",
              "100000",
              "",
              "ACTIVE",
              "/images/technest-product-placeholder.svg",
              `IMPORT-${key}`,
              "Mặc định",
              "100000",
              5,
            ]);
          const preview = await excel.preview(
            Buffer.from(await book.xlsx.writeBuffer()),
            "fixture.xlsx",
            user!.id,
          );
          expect(preview.errors).toEqual([]);
          const job = await excel.runBatch(String(preview.job!.id), user!.id);
          expect(job!.status).toBe("COMPLETED");
          await excel.runBatch(String(job!.id), user!.id);
          const delivered = (
            await orders.create({ ...body, idempotencyKey: crypto.randomUUID() }, user!)
          ).order!;
          for (const status of ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const)
            await orders.transition(delivered.id, status, user!.id);
          await expect(
            ops.createAfterSales(
              {
                orderId: delivered.id,
                itemId: delivered.items[0]!.id,
                type: "RETURN",
                quantity: 1,
                reason: "Sản phẩm cần kiểm tra",
              },
              user!.id + 999999,
            ),
          ).rejects.toThrow();
          const returned = await ops.createAfterSales(
            {
              orderId: delivered.id,
              itemId: delivered.items[0]!.id,
              type: "RETURN",
              quantity: 1,
              reason: "Sản phẩm cần kiểm tra",
            },
            user!.id,
          );
          for (const status of ["APPROVED", "RECEIVED", "RESOLVED"] as const)
            await ops.updateAfterSales(String(returned!.id), {
              status,
              adminNote: "Đã kiểm tra",
              resolution: status === "RESOLVED" ? "REFUND" : null,
              refundAmount: status === "RESOLVED" ? "99001" : "0",
              restock: status === "RESOLVED",
            });
          expect(
            (await tx.select().from(s.inventories).where(eq(s.inventories.variantId, v!.id)))[0]!
              .onHand,
          ).toBe(10);
          await expect(
            ops.updateAfterSales(String(returned!.id), {
              status: "RESOLVED",
              adminNote: "",
              resolution: "REFUND",
              refundAmount: "99001",
              restock: true,
            }),
          ).rejects.toThrow();
          const [email] = await tx
            .select()
            .from(s.orderEmailOutbox)
            .where(eq(s.orderEmailOutbox.orderId, delivered.id))
            .limit(1);
          await tx
            .update(s.orderEmailOutbox)
            .set({ status: "FAILED" })
            .where(eq(s.orderEmailOutbox.id, email!.id));
          const retry = await ops.retryEmail(email!.id.toString());
          expect(String(retry!.id)).not.toBe(email!.id.toString());
          await expect(ops.retryEmail(email!.id.toString())).rejects.toThrow();
          await request(app)
            .get("/api/v1/admin/reports")
            .set("Authorization", "Bearer admin")
            .expect(200);
          const audit = await request(app).get("/api/v1/admin/audit").set("Authorization","Bearer admin").expect(200);
          expect(audit.body.data.items.length).toBeGreaterThan(0);
          const publicBanner = await request(app).post("/api/v1/admin/banners").set("Authorization","Bearer admin").send({title:"Active fixture banner", imageUrl:"/images/technest-product-placeholder.svg",link:"/products"}).expect(201);
          const activeBanners=await request(app).get("/api/v1/banners?position=HOME_PROMO").expect(200);expect(activeBanners.body.data.some((b:{id:string})=>b.id===publicBanner.body.data.id)).toBe(true);
          const otherPlacement=await request(app).get("/api/v1/banners?position=HOME_BOTTOM").expect(200);expect(otherPlacement.body.data.some((b:{id:string})=>b.id===publicBanner.body.data.id)).toBe(false);
          await request(app).get("/api/v1/banners?position=INVALID").expect(400);
          await request(app).delete(`/api/v1/admin/banners/${publicBanner.body.data.id}`).set("Authorization","Bearer admin").expect(200);
          throw stop;
        });
      } catch (e) {
        if (e !== stop) throw e;
      } finally {
        await pool.end();
      }
    }, 60000);
  },
);
