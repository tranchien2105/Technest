import nodemailer from "nodemailer";
import { createElement } from "react";
import { render } from "@react-email/render";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import * as schema from "../../database/schema/index.js";
import { orderEmailOutbox } from "../../database/schema/email.js";
import { orderEmailPayloadSchema, type OrderEmailEvent } from "./order-email.types.js";
import { OrderEmail, orderEmailSubject } from "./templates/order-email.js";

type Database = NodePgDatabase<typeof schema>;
export type OrderEmailRow = typeof orderEmailOutbox.$inferSelect;

export function createOrderEmailService(env: Env) {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && env.SMTP_PASSWORD
      ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
      : {}),
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false,
    debug: false,
  });

  async function send(row: OrderEmailRow) {
    const event = row.eventType as OrderEmailEvent;
    const parsed = orderEmailPayloadSchema.parse(row.payload);
    const payload = { ...parsed, items: parsed.items.map(item => ({ ...item, ...(item.imageUrl ? { imageUrl: new URL(item.imageUrl, env.FRONTEND_URL).href } : {}) })) };
    const html = await render(
      createElement(OrderEmail, {
        event,
        payload,
        customerName: row.recipientName || "",
        orderUrl: `${env.FRONTEND_URL}/account/orders/${encodeURIComponent(row.orderId)}`,
        supportEmail: env.EMAIL_SUPPORT_EMAIL,
        supportName: env.EMAIL_SUPPORT_NAME,
      }),
    );
    await transporter.sendMail({
      from: env.EMAIL_FROM,
      to: row.recipientEmail,
      subject: orderEmailSubject(event, payload.orderNumber),
      html,
      messageId: `<${row.eventKey.replaceAll(":", ".")}@technest>`,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
  }

  async function markSent(db: Database, id: bigint) {
    await db
      .update(orderEmailOutbox)
      .set({
        status: "SENT",
        sentAt: new Date(),
        lockedUntil: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(orderEmailOutbox.id, id));
  }

  async function markFailedAttempt(db: Database, id: bigint, errorCode: string) {
    await db
      .update(orderEmailOutbox)
      .set({ status: "PENDING", lockedUntil: null, lastError: errorCode, updatedAt: new Date() })
      .where(eq(orderEmailOutbox.id, id));
  }

  return { send, markSent, markFailedAttempt };
}

export type OrderEmailDatabase = NodePgDatabase<typeof import("../../database/schema/index.js")>;
