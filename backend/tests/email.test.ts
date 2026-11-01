import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import { parseEnv } from "../src/config/env.js";
import { createOrderEmailService, type OrderEmailRow } from "../src/modules/email/order-email.service.js";
import { orderEmailEventSchema } from "../src/modules/email/order-email.types.js";
import { render } from "@react-email/render";
import { orderEmailEventKey } from "../src/modules/email/order-email.outbox.js";
import { orderEmailSubject, OrderEmail } from "../src/modules/email/templates/order-email.js";
import type { OrderEmailEvent, OrderEmailPayload } from "../src/modules/email/order-email.types.js";

const payload: OrderEmailPayload = {
  orderNumber: "TN-2026-001",
  createdAt: "2026-10-31T08:00:00.000Z",
  items: [
    {
      name: "Bàn phím Technest",
      sku: "TN-KEY-01",
      imageUrl: "https://example.test/keyboard.jpg",
      quantity: 2,
      unitPrice: "1250000",
    },
  ],
  subtotal: "2500000",
  shipping: "30000",
  discount: "100000",
  total: "2430000",
  shippingAddress: {
    recipient: "Nguyễn An",
    phone: "0900000000",
    line1: "12 Đường Mẫu",
    city: "TP. Hồ Chí Minh",
  },
};

describe("transactional order emails", () => {
  it.each(orderEmailEventSchema.options)("renders and submits %s through the mail service", async (event) => {
    const sendMail = vi.fn().mockResolvedValue({});
    const transport = vi.spyOn(nodemailer, "createTransport").mockReturnValue(
      { sendMail } as unknown as ReturnType<typeof nodemailer.createTransport>,
    );
    try {
      const env = parseEnv({
        NODE_ENV: "test",
        AUTH_JWT_SECRET: "test-secret-with-at-least-32-characters",
        DATABASE_URL: "postgres://test:test@localhost/test",
        REDIS_URL: "redis://localhost:6379",
      });
      const now = new Date();
      const row: OrderEmailRow = {
        id: 184n, retryOfId: null, eventKey: orderEmailEventKey("184", event), eventType: event,
        orderId: "184", recipientEmail: "customer@example.test", recipientName: "Nguyễn An",
        payload, status: "PENDING", attempts: 0, enqueuedAt: null,
        lockedUntil: null, sentAt: null, lastError: null, createdAt: now, updatedAt: now,
      };
      await createOrderEmailService(env).send(row);
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: "customer@example.test",
        subject: orderEmailSubject(event, payload.orderNumber),
        html: expect.stringContaining("/account/orders/184"),
      }));
    } finally {
      transport.mockRestore();
    }
  });

  it("uses a stable unique event key and required confirmation subject", () => {
    expect(orderEmailEventKey("184", "ORDER_PLACED")).toBe("order:184:ORDER_PLACED");
    expect(orderEmailSubject("ORDER_PLACED", payload.orderNumber)).toBe(
      "Technest | Xác nhận đơn hàng #TN-2026-001",
    );
  });

  it("renders Vietnamese order details, totals and COD for placed orders", async () => {
    const html = await render(
      createElement(OrderEmail, {
        event: "ORDER_PLACED",
        payload,
        customerName: "Nguyễn An",
        orderUrl: "http://localhost:5173/account/orders/184",
        supportEmail: "support@example.test",
        supportName: "Technest Support",
      }),
    );
    expect(html).toContain("Đặt hàng thành công!");
    expect(html).toContain("TN-KEY-01");
    expect(html).toContain("2.430.000 ₫");
    expect(html).toContain("Thanh toán khi nhận hàng (COD)");
    expect(html).toContain("12 Đường Mẫu");
    expect(html).toContain('src="https://example.test/keyboard.jpg"');
  });

  it("does not invent carrier details when a shipment event has no carrier data", async () => {
    const html = await render(
      createElement(OrderEmail, {
        event: "ORDER_SHIPPED" satisfies OrderEmailEvent,
        payload,
        customerName: "Nguyễn An",
        orderUrl: "http://localhost:5173/account/orders/184",
        supportEmail: "support@example.test",
        supportName: "Technest Support",
      }),
    );
    expect(html).toContain("Đơn hàng đang trên đường đến bạn!");
    expect(html).not.toContain("Đơn vị vận chuyển:");
    expect(html).not.toContain("Mã vận đơn:");
  });
});
