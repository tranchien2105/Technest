export type OrderStatusEvent = {
  orderId: string;
  orderNumber: string;
  status: string;
  updatedAt: string;
};

type Listener = { userId?: string; admin: boolean; send: (event: OrderStatusEvent) => void };

/** In-process push is a latency optimization; REST/ PostgreSQL remain authoritative. */
export function createOrderEventHub() {
  const listeners = new Set<Listener>();
  return {
    publish(userId: string, event: OrderStatusEvent) {
      for (const listener of listeners) {
        if (listener.userId === userId || listener.admin) listener.send(event);
      }
    },
    subscribe(listener: Listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
  };
}

export type OrderEventHub = ReturnType<typeof createOrderEventHub>;
