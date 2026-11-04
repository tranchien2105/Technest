export interface HealthDependencies {
  postgres: () => Promise<unknown>;
  redis: () => Promise<unknown>;
  isReady?: () => boolean;
}

async function probe(check: () => Promise<unknown>) {
  const started = performance.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(check),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("Probe timed out")), 3000);
      }),
    ]);
    return { status: "up" as const, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { status: "down" as const, latencyMs: Math.round(performance.now() - started) };
  } finally {
    clearTimeout(timeout);
  }
}

export function createHealthService(dependencies: HealthDependencies) {
  return async () => {
    if (dependencies.isReady?.() === false) {
      return { status: "not_ready" as const, timestamp: new Date().toISOString(), uptime: Math.floor(process.uptime()), dependencies: {} };
    }
    const [postgres, redis] = await Promise.all([
      probe(dependencies.postgres),
      probe(dependencies.redis),
    ]);
    return {
      status:
        dependencies.isReady?.() === false ? ("not_ready" as const) : postgres.status === "up" && redis.status === "up" ? ("ok" as const) : ("degraded" as const),
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
      dependencies: { postgres, redis },
    };
  };
}
