import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { orderEmailOutbox } from "../../database/schema/email.js";
import { orderEmailPayloadSchema, type OrderEmailEvent } from "./order-email.types.js";

type Database = NodePgDatabase<typeof schema>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export interface RecordOrderEmailInput {
  event: OrderEmailEvent;
  orderId: string;
  orderNumber: string;
  recipientEmail: string;
  recipientName?: string | null;
  payload: unknown;
}

export function orderEmailEventKey(orderId: string, event: OrderEmailEvent) {
  return `order:${orderId}:${event}`;
}

/** Call this with the same Drizzle transaction that successfully changes order state. */
export async function recordOrderEmail(
  transaction: Transaction | Database,
  input: RecordOrderEmailInput,
) {
  const payload = orderEmailPayloadSchema.parse(input.payload);
  const recipientEmail = input.recipientEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
    throw new Error("Invalid order notification recipient");
  }

  const [event] = await transaction
    .insert(orderEmailOutbox)
    .values({
      eventKey: orderEmailEventKey(input.orderId, input.event),
      eventType: input.event,
      orderId: input.orderId,
      recipientEmail,
      recipientName: input.recipientName?.trim() || null,
      payload,
    })
    .onConflictDoNothing({ target: orderEmailOutbox.eventKey })
    .returning({ id: orderEmailOutbox.id });
  return event?.id.toString() ?? null;
}
