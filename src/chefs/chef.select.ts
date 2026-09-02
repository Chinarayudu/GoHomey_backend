import { Prisma } from '@prisma/client';

/**
 * Chef columns that are safe to return to any authenticated user and in public
 * listings (meals, pantry, social events, fuel plans, feed, follows, ...).
 *
 * Intentionally INCLUDES `food_safety_cert_url` — the FSSAI / food-safety
 * certificate is surfaced to customers as a trust signal.
 *
 * Intentionally EXCLUDES `password`, `government_id_url`, `bank_name`,
 * `bank_account_number`, `ifsc_code`. Never widen this to add those — use
 * `privateChefProfileSelect` (chefs.service.ts), which is only returned to the
 * chef themselves.
 */
export const publicChefSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  role: true,
  bio: true,
  rating: true,
  is_verified: true,
  trust_tier: true,
  created_at: true,
  updated_at: true,
  primary_cuisine: true,
  kitchen_name: true,
  kitchen_address: true,
  latitude: true,
  longitude: true,
  max_capacity: true,
  max_concurrent_slots_per_hour: true,
  appliances: true,
  kitchen_photo_url: true,
  food_safety_cert_url: true,
  application_status: true,
  registration_step: true,
  user_id: true,
} satisfies Prisma.ChefSelect;

/** `publicChefSelect` plus the linked User's display name. */
export const publicChefSelectWithUser = {
  ...publicChefSelect,
  user: { select: { name: true } },
} satisfies Prisma.ChefSelect;
