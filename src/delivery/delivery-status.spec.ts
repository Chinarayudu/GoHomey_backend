import { DeliveryStatus } from '@prisma/client';
import { isForwardDeliveryTransition } from './delivery-status';

describe('isForwardDeliveryTransition', () => {
  it.each([
    [DeliveryStatus.PENDING, DeliveryStatus.ASSIGNED, true],
    [DeliveryStatus.ASSIGNED, DeliveryStatus.PICKED_UP, true],
    [DeliveryStatus.PICKED_UP, DeliveryStatus.DELIVERED, true],
    [DeliveryStatus.ASSIGNED, DeliveryStatus.FAILED, true],
    [DeliveryStatus.ASSIGNED, DeliveryStatus.ASSIGNED, false],
    [DeliveryStatus.PICKED_UP, DeliveryStatus.ASSIGNED, false],
    [DeliveryStatus.DELIVERED, DeliveryStatus.PICKED_UP, false],
    [DeliveryStatus.DELIVERED, DeliveryStatus.FAILED, false],
    [DeliveryStatus.FAILED, DeliveryStatus.ASSIGNED, false],
  ])('%s -> %s is %s', (current, next, expected) => {
    expect(isForwardDeliveryTransition(current, next)).toBe(expected);
  });
});
