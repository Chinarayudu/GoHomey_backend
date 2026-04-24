import { prisma } from '../../prisma/prisma.service';
import { FaultType, OrderStatus } from '@prisma/client';

export class PayoutsService {
  /**
   * Calculate chef payout based on order status and fault type
   * @param orderId 
   */
  async calculateChefPayout(orderId: string) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { chef: true },
    });

    if (!order) throw new Error('Order not found');

    const totalAmount = order.total_price;
    let chefPayout = 0;

    if (order.status === OrderStatus.DELIVERED) {
      // 100% Payout for successful delivery
      chefPayout = totalAmount;
    } else if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
      if (order.fault_type === FaultType.CHEF) {
        // Chef at fault: 40% payout to cover ingredients
        chefPayout = totalAmount * 0.4;
      } else if (order.fault_type === FaultType.DRIVER || !order.fault_type) {
        // GoHomey/Driver at fault: Chef is paid 100%
        chefPayout = totalAmount;
      } else if (order.fault_type === FaultType.CUSTOMER) {
        // Customer fraudulent: Chef is paid 100% (GoHomey denies refund to customer)
        chefPayout = totalAmount;
      }
    }

    return chefPayout;
  }

  /**
   * Handle Trust-Tier 2 Payout (50% Advance)
   * @param chefId 
   */
  async requestAdvancePayout(chefId: string, orderId: string) {
    const chef = await prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef || chef.trust_tier < 2) {
      throw new Error('Advance payout only available for Verified Chefs (Trust-Tier 2)');
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found');

    // Logic to release 50% of the order value from escrow to the chef's wallet/bank
    // This would integrate with a payment gateway like Razorpay Route or similar.
    return {
      status: 'success',
      advance_amount: order.total_price * 0.5,
      message: 'Advance payout initiated',
    };
  }
}

export const payoutsService = new PayoutsService();
