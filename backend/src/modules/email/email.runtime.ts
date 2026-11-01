import { createClient } from "redis";
import { Queue, Worker, createNodeRedisClient, type Job } from "bullmq";
import { and, asc, eq, isNull, lt, or } from "drizzle-orm";
import type { Logger } from "pino";
import type { Env } from "../../config/env.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../database/schema/index.js";
import { orderEmailOutbox } from "../../database/schema/email.js";
import { createOrderEmailService } from "./order-email.service.js";
import { orderEmailJobSchema } from "./order-email.types.js";

type Database = NodePgDatabase<typeof schema>;
const QUEUE_NAME = "technest-transactional-email";
const MAX_ATTEMPTS = 5;
const LOCK_MILLISECONDS = 45_000;

export function createTransactionalEmailRuntime(db: Database, env: Env, logger: Logger) {
  const redis = createClient({ url: env.REDIS_URL, socket: { connectTimeout: 2000 } });
  redis.on("error", () => logger.error("Transactional email Redis connection error"));
  const connection = createNodeRedisClient(redis);
  const queue = new Queue(QUEUE_NAME, { connection });
  const mail = createOrderEmailService(env);
  const worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const parsed = orderEmailJobSchema.parse(job.data);
      const id = BigInt(parsed.outboxId);
      const claimed = await db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(orderEmailOutbox)
          .where(eq(orderEmailOutbox.id, id))
          .for("update", { skipLocked: true });
        if (!row || row.status === "SENT" || row.status === "FAILED") return null;
        if (row.status === "PROCESSING" && row.lockedUntil && row.lockedUntil > new Date())
          return null;
        await tx
          .update(orderEmailOutbox)
          .set({
            status: "PROCESSING",
            attempts: row.attempts + 1,
            lockedUntil: new Date(Date.now() + LOCK_MILLISECONDS),
            updatedAt: new Date(),
          })
          .where(eq(orderEmailOutbox.id, id));
        return row;
      });

      if (!claimed) {
        const [current] = await db
          .select({ status: orderEmailOutbox.status })
          .from(orderEmailOutbox)
          .where(eq(orderEmailOutbox.id, id))
          .limit(1);
        if (!current || current.status === "SENT" || current.status === "FAILED") return;
        throw new Error("ORDER_EMAIL_OUTBOX_BUSY");
      }

      try {
        await mail.send(claimed);
        await mail.markSent(db, claimed.id);
      } catch {
        await mail.markFailedAttempt(db, claimed.id, "SMTP_DELIVERY_FAILED");
        throw new Error("SMTP_DELIVERY_FAILED");
      }
    },
    {
      connection,
      concurrency: 5,
      lockDuration: LOCK_MILLISECONDS,
      maxStalledCount: 2,
    },
  );

  queue.on("error", () => logger.error("Transactional email queue error"));
  worker.on("error", () => logger.error("Transactional email worker error"));
  worker.on("failed", (job, error) => {
    if (!job || job.attemptsMade < (job.opts.attempts ?? MAX_ATTEMPTS)) return;
    const jobData = orderEmailJobSchema.safeParse(job.data);
    if (!jobData.success) return;
    const id = BigInt(jobData.data.outboxId);
    void db
      .update(orderEmailOutbox)
      .set({
        status: "FAILED",
        lockedUntil: null,
        lastError: error.name === "Error" ? "MAX_RETRIES_EXHAUSTED" : "EMAIL_DELIVERY_FAILED",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orderEmailOutbox.id, id),
          or(eq(orderEmailOutbox.status, "PENDING"), eq(orderEmailOutbox.status, "PROCESSING")),
        ),
      )
      .then(() =>
        logger.error({ outboxId: jobData.data.outboxId }, "Transactional email exhausted retries"),
      )
      .catch(() =>
        logger.error(
          { outboxId: jobData.data.outboxId },
          "Could not persist failed transactional email",
        ),
      );
  });

  let dispatchTimer: NodeJS.Timeout | undefined;
  let dispatching = false;

  async function dispatchPending() {
    if (dispatching) return;
    dispatching = true;
    try {
      const now = new Date();
      await db
        .update(orderEmailOutbox)
        .set({ status: "PENDING", lockedUntil: null, enqueuedAt: null, updatedAt: now })
        .where(
          and(eq(orderEmailOutbox.status, "PROCESSING"), lt(orderEmailOutbox.lockedUntil, now)),
        );
      const pending = await db
        .select({ id: orderEmailOutbox.id })
        .from(orderEmailOutbox)
        .where(and(eq(orderEmailOutbox.status, "PENDING"), isNull(orderEmailOutbox.enqueuedAt)))
        .orderBy(asc(orderEmailOutbox.createdAt))
        .limit(50);
      for (const row of pending) {
        const outboxId = row.id.toString();
        await queue.add(
          "send-order-email",
          { outboxId },
          {
            jobId: `order-email-${outboxId}`,
            attempts: MAX_ATTEMPTS,
            backoff: { type: "exponential", delay: 1_000 },
            removeOnComplete: { age: 86_400, count: 1_000 },
            removeOnFail: false,
          },
        );
        await db
          .update(orderEmailOutbox)
          .set({ enqueuedAt: new Date(), updatedAt: new Date() })
          .where(
            and(
              eq(orderEmailOutbox.id, row.id),
              eq(orderEmailOutbox.status, "PENDING"),
              isNull(orderEmailOutbox.enqueuedAt),
            ),
          );
      }
    } catch {
      logger.error("Transactional email outbox dispatch failed");
    } finally {
      dispatching = false;
    }
  }

  async function start() {
    dispatchTimer = setInterval(() => void dispatchPending(), 1_000);
    dispatchTimer.unref();
    // Queue/SMTP recovery must never hold the HTTP server's startup path.
    void dispatchPending();
    logger.info("Transactional email worker started");
  }

  async function close() {
    if (dispatchTimer) clearInterval(dispatchTimer);
    await Promise.allSettled([worker.close(), queue.close()]);
    if (redis.isOpen) await redis.close();
  }

  return { start, close, dispatchPending };
}

export type TransactionalEmailRuntime = ReturnType<typeof createTransactionalEmailRuntime>;
export type TransactionalEmailJob = Job;
