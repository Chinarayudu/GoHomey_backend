# GoHomeyy Fuel Admin Guide

This document is only for the admin website Fuel screens.

Use this document for the admin website experience where GoHomeyy creates standardized Fuel plans, manages operational generation, and tests reminder jobs.

## Base URL

```text
https://gohomeyy-backend.onrender.com/api/v1
```

## Admin Fuel Flow

1. Admin creates standardized Fuel plans.
2. Admin defines macros, price, duration, payout, and SOP/menu JSON.
3. Backend automatically generates fulfillment rows every night at 11:59 PM IST.
4. Admin can manually trigger fulfillment generation if needed.
5. Admin can manually trigger prep reminder sweep for testing.

Important:

- Admin creates Fuel plans.
- Chefs cannot create Fuel plans from the chef app.
- Users can only subscribe to published/available plans.
- Delivery partner dispatch after `READY_FOR_PICKUP` is still pending and will be added during delivery integration.

## Admin Auth

All admin endpoints need:

```http
Authorization: Bearer <admin_jwt>
```

## List Fuel Plans

```http
GET /fuel/plans
```

Use this for Fuel plan table/list.

## Get Fuel Plan Details

```http
GET /fuel/plans/:id
```

Use this for plan detail/review.

## Create Fuel Plan

```http
POST /fuel/plans
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

Request:

```json
{
  "name": "Keto Lean Shred",
  "goal": "WEIGHT_LOSS",
  "description": "Low-carb high-protein standardized plan",
  "price": 5999,
  "duration_days": 30,
  "fixed_chef_payout": 4200,
  "sop_document_url": "https://res.cloudinary.com/...",
  "menu_json": {
    "days": [
      {
        "day": 1,
        "meal": "Paneer protein bowl",
        "ingredients": [
          { "name": "Paneer", "grams": 150 },
          { "name": "Broccoli", "grams": 100 }
        ],
        "steps": ["Weigh ingredients", "Cook", "Plate", "Weigh final meal"]
      }
    ]
  },
  "calories": 1800,
  "protein": 140,
  "carbs": 60,
  "fat": 80
}
```

Field notes:

- `price` is customer price.
- `duration_days` defaults to 30 if omitted.
- `fixed_chef_payout` is optional but recommended for admin finance tracking.
- `sop_document_url` should be a Cloudinary or other hosted document URL.
- `menu_json` should store standardized recipe/SOP details.

## Manual Fulfillment Generation

```http
POST /fuel/fulfillments/generate
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

Request:

```json
{
  "daysAhead": 2
}
```

Purpose:

- Creates/confirms daily Fuel fulfillment rows for active subscriptions.
- Useful for manual testing or recovery.

Automatic behavior:

- Backend runs this every night at 11:59 PM IST.
- It generates next 48 hours of fulfillment rows.

## Manual Prep Reminder Sweep

```http
POST /fuel/reminders/prep/run
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

Request:

```json
{
  "hoursBefore": 3
}
```

Response:

```json
{
  "message": "Sent 2 Fuel prep reminder(s)",
  "fulfillment_ids": ["..."]
}
```

Purpose:

- Admin can test reminder logic manually.
- Backend otherwise checks every 10 minutes automatically.

## Status Reference

Fuel subscription statuses:

```text
ACTIVE
PAUSED
CANCELLED
COMPLETED
```

Fuel fulfillment statuses:

```text
SCHEDULED
COOKING
READY_FOR_PICKUP
PICKED_UP
DELIVERED
PAUSED
MISSED
CANCELLED
```

## Admin UI Checklist

- Fuel plans list.
- Fuel plan create form.
- SOP/menu JSON editor.
- Macro fields: calories, protein, carbs, fat.
- Price and chef payout fields.
- Manual generate fulfillment button.
- Manual prep reminder test button.

## Still Pending Outside Admin Fuel

Delivery partner dispatch after `READY_FOR_PICKUP` is still separate and not part of this admin Fuel document yet.

## Backend Setup Notes

Run the Fuel migration before testing Fuel endpoints on any database that does not yet have the Fuel tables:

```powershell
.\node_modules\.bin\prisma.cmd db execute --file .\prisma\migrations\202605240001_add_fuel_service_models\migration.sql
```

Enable the automatic scheduler in production:

```text
FUEL_SCHEDULER_ENABLED=true
```
