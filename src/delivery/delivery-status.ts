import { DeliveryStatus } from '@prisma/client';

const PROGRESS_RANK: Partial<Record<DeliveryStatus, number>> = {
  [DeliveryStatus.PENDING]: 0,
  [DeliveryStatus.ASSIGNED]: 1,
  [DeliveryStatus.PICKED_UP]: 2,
};

/**
 * Shadowfax callbacks (and status-API polls) can arrive late or out of order,
 * e.g. an ARRIVED callback landing after DISPATCHED, or any callback after
 * DELIVERED. Only move a delivery forward; DELIVERED and FAILED are terminal.
 */
export function isForwardDeliveryTransition(
  current: DeliveryStatus,
  next: DeliveryStatus,
): boolean {
  const currentRank = PROGRESS_RANK[current];
  if (currentRank === undefined) return false;

  const nextRank = PROGRESS_RANK[next];
  if (nextRank === undefined) return true;

  return nextRank > currentRank;
}
