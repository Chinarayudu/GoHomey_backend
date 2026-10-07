/**
 * In-process background jobs for orders (replaces the former BullMQ/Redis
 * queue). dispatchOrderJob() never blocks or throws in the caller: the job runs
 * on the next tick and failures are only logged. Jobs are not persisted, so a
 * job in flight during a restart is lost — fine while handlers are best-effort.
 */
export type OrderJobName =
  | 'send-order-notification'
  | 'trigger-delivery'
  | 'update-analytics'
  | 'send-order-status-update';

export function dispatchOrderJob(name: OrderJobName, data: any): void {
  setImmediate(() => {
    runOrderJob(name, data).catch((err) => {
      console.error(`Order job ${name} failed with ${err instanceof Error ? err.message : err}`);
    });
  });
}

export async function runOrderJob(name: string, data: any) {
  console.log(`Processing order job ${name}`);

  switch (name) {
    case 'send-order-notification':
      return handleSendOrderNotification(data);
    case 'trigger-delivery':
      return handleTriggerDelivery(data);
    case 'update-analytics':
      return handleUpdateAnalytics(data);
    case 'send-order-status-update':
      return handleSendOrderStatusUpdate(data);
    default:
      console.warn(`Unknown job type: ${name}`);
  }
}

async function handleSendOrderNotification(data: { orderId: string }) {
  console.log(`Sending notification for order ${data.orderId}`);
  // Here we would call Notification Service logic
  return { success: true };
}

async function handleTriggerDelivery(data: { orderId: string }) {
  console.log(`Triggering delivery for order ${data.orderId}`);
  // Here we would call Delivery Service logic
  return { success: true };
}

async function handleUpdateAnalytics(data: { orderId: string; amount: number }) {
  console.log(`Updating analytics for order ${data.orderId}`);
  // Here we would update some analytics table
  return { success: true };
}

async function handleSendOrderStatusUpdate(data: { orderId: string; userId: string; status: string }) {
  console.log(`Notifying user ${data.userId} that order ${data.orderId} is now ${data.status}`);
  return { success: true };
}
