import {
  calculateDistance,
  DELIVERY_RADIUS_KM,
} from '../common/utils/location';
import { publicChefSelect, publicChefSelectWithUser } from '../chefs/chef.select';
import { prisma } from '../prisma/prisma.service';
import { OrderStatus, PantryUnitType, Prisma } from '@prisma/client';

const OPEN_ORDER_STATUSES: OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'OUT_FOR_DELIVERY',
];

function httpError(message: string, status: number) {
  const error: any = new Error(message);
  error.status = status;
  return error;
}

/**
 * Resolves the final unit_type / pieces_per_unit from the request and, on
 * update, the item's current values. ITEM always has 1 piece; CONTAINER needs
 * an explicit pieces_per_unit.
 */
function resolvePantryUnit(
  data: { unit_type?: PantryUnitType; pieces_per_unit?: number },
  current?: { unit_type: PantryUnitType; pieces_per_unit: number },
) {
  const unitType = data.unit_type ?? current?.unit_type ?? 'ITEM';

  if (unitType === 'ITEM') {
    return { unit_type: unitType, pieces_per_unit: 1 };
  }

  // Switching ITEM -> CONTAINER must say how many pieces the container holds.
  const piecesPerUnit =
    data.pieces_per_unit ??
    (current?.unit_type === 'CONTAINER' ? current.pieces_per_unit : undefined);
  if (piecesPerUnit === undefined) {
    throw httpError(
      'pieces_per_unit is required when unit_type is CONTAINER',
      400,
    );
  }

  return { unit_type: unitType, pieces_per_unit: piecesPerUnit };
}

/** Adds price_per_piece (price / pieces_per_unit, 2 decimals) for clients. */
export function serializePantryItem<
  T extends { price: number; pieces_per_unit?: number | null },
>(item: T) {
  const pieces = item.pieces_per_unit && item.pieces_per_unit > 0 ? item.pieces_per_unit : 1;
  return {
    ...item,
    price_per_piece: Math.round((item.price / pieces) * 100) / 100,
  };
}

export class PantryService {
  async create(chefId: string, data: any): Promise<any> {
    const chef = await prisma.chef.findUnique({ where: { id: chefId } });
    if (!chef) {
      const error: any = new Error('Chef profile not found');
      error.status = 404;
      throw error;
    }

    const item = await prisma.pantryItem.create({
      data: {
        ...data,
        ...resolvePantryUnit(data),
        chef_id: chefId,
      },
    });
    return serializePantryItem(item);
  }

  async findAll(query: {
    chefId?: string;
    category?: string;
    latitude?: number;
    longitude?: number;
  }) {
    const { chefId, category, latitude, longitude } = query;
    const items = await prisma.pantryItem.findMany({
      where: {
        chef_id: chefId,
        ...(category ? { category } : {}),
      },
      include: {
        chef: { select: publicChefSelectWithUser },
      },
    });

    if (
      latitude !== undefined &&
      longitude !== undefined &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      return items
        .filter((item) => {
          if (item.chef.latitude == null || item.chef.longitude == null) {
            return false;
          }
          const distance = calculateDistance(
            latitude,
            longitude,
            item.chef.latitude,
            item.chef.longitude,
          );
          return distance <= DELIVERY_RADIUS_KM;
        })
        .map(serializePantryItem);
    }

    return items.map(serializePantryItem);
  }

  async findOne(id: string): Promise<any> {
    const item = await prisma.pantryItem.findUnique({
      where: { id },
      include: { chef: { select: publicChefSelect } },
    });
    if (!item) {
      const error: any = new Error('Pantry item not found');
      error.status = 404;
      throw error;
    }
    return serializePantryItem(item);
  }

  async update(id: string, chefId: string, data: any): Promise<any> {
    const item = await this.findOne(id);
    if (!item) {
      const error: any = new Error('Pantry item not found');
      error.status = 404;
      throw error;
    }
    if (item.chef_id !== chefId) {
      const error: any = new Error('You can only update your own items');
      error.status = 403;
      throw error;
    }

    const unit = resolvePantryUnit(data, item);

    if (unit.unit_type !== item.unit_type) {
      const openOrders = await prisma.orderItem.count({
        where: {
          pantry_id: id,
          order: { status: { in: OPEN_ORDER_STATUSES } },
        },
      });
      if (openOrders > 0) {
        throw httpError(
          'Cannot change unit_type while this item has open orders',
          409,
        );
      }
    }

    const updated = await prisma.pantryItem.update({
      where: { id },
      data: { ...data, ...unit },
    });
    return serializePantryItem(updated);
  }

  async remove(id: string, chefId: string): Promise<void> {
    const item = await this.findOne(id);
    if (!item || item.chef_id !== chefId) {
      const error: any = new Error('You can only delete your own items');
      error.status = 403;
      throw error;
    }
    await prisma.pantryItem.delete({ where: { id } });
  }
}

export const pantryService = new PantryService();
