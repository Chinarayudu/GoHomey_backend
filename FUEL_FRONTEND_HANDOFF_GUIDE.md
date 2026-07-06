# GoHomeyy Fuel Frontend Handoff Guide

Use this document for implementing Fuel in the frontend apps and admin surfaces.

Base URL:

```text
https://gohomeyy-backend.onrender.com/api/v1
```

Local development URL:

```text
http://localhost:3000/api/v1
```

## Fuel Plan Durations

Fuel plans support only these durations:

```text
3 days
1 week
1 month
```

Backend values:

```json
[
  { "label": "3 days", "duration_days": 3 },
  { "label": "1 week", "duration_days": 7 },
  { "label": "1 month", "duration_days": 30 }
]
```

Every plan response includes:

```json
{
  "duration_days": 7,
  "duration_label": "1 week"
}
```

Frontend should show `duration_label` when available.

## Fuel Menu Structure

Each Fuel plan has a day-wise menu. Every day has three meals:

```text
Breakfast
Lunch
Dinner
```

Expected `menu_json` shape:

```json
{
  "days": [
    {
      "day": 1,
      "meals": {
        "breakfast": {
          "name": "Poha with sprouts",
          "time_slot": "08:00"
        },
        "lunch": {
          "name": "Rice, dal, mixed sabzi and curd",
          "time_slot": "13:00"
        },
        "dinner": {
          "name": "Roti, paneer bhurji and salad",
          "time_slot": "19:00"
        }
      }
    },
    {
      "day": 2,
      "meals": {
        "breakfast": {
          "name": "Oats bowl with banana",
          "time_slot": "08:00"
        },
        "lunch": {
          "name": "Millet khichdi and raita",
          "time_slot": "13:00"
        },
        "dinner": {
          "name": "Grilled tofu bowl",
          "time_slot": "19:00"
        }
      }
    }
  ]
}
```

Frontend rendering rules:

- On plan detail page, show menu as day tabs or an accordion.
- Each day should show Breakfast, Lunch, and Dinner separately.
- Use `time_slot` to show meal timing.
- Do not show raw JSON to users.
- If older plans have empty `menu_json.days`, show an empty menu state.

## Admin App: Create Fuel Plan

Admins create Fuel plans from the admin website.

```http
POST /fuel/plans
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

Request body:

```json
{
  "name": "High Protein Vegetarian Plan",
  "goal": "MUSCLE_GAIN",
  "description": "Daily high protein vegetarian meals.",
  "price": 2499,
  "duration_days": 7,
  "fixed_chef_payout": 1800,
  "sop_document_url": "https://example.com/sop.pdf",
  "delivery_time_slots": ["08:00", "13:00", "19:00"],
  "menu_json": {
    "days": [
      {
        "day": 1,
        "meals": {
          "breakfast": {
            "name": "Paneer stuffed paratha",
            "time_slot": "08:00"
          },
          "lunch": {
            "name": "Dal, rice, sabzi and curd",
            "time_slot": "13:00"
          },
          "dinner": {
            "name": "Tofu bowl with vegetables",
            "time_slot": "19:00"
          }
        }
      }
    ]
  },
  "calories": 1800,
  "protein": 120,
  "carbs": 180,
  "fat": 55
}
```

Validation:

- `duration_days` must be `3`, `7`, or `30`.
- `delivery_time_slots` must include at least one time slot.
- `price` must be greater than zero.
- For the admin UI, require Breakfast, Lunch, and Dinner for every selected day.

Admin create-form behavior:

- If admin selects `3 days`, show Day 1 to Day 3.
- If admin selects `1 week`, show Day 1 to Day 7.
- If admin selects `1 month`, show Day 1 to Day 30.
- For every day, collect Breakfast, Lunch, and Dinner food names.
- Collect Breakfast, Lunch, and Dinner delivery times once and reuse those times in every day menu entry.

## User App: List Fuel Plans

```http
GET /fuel/plans
```

Use this for the Fuel landing/listing page.

Response item:

```json
{
  "id": "plan-id",
  "name": "High Protein Vegetarian Plan",
  "goal": "MUSCLE_GAIN",
  "description": "Daily high protein vegetarian meals.",
  "price": 2499,
  "duration_days": 7,
  "duration_label": "1 week",
  "price_to_customer": 2499,
  "fixed_chef_payout": 1800,
  "sop_document_url": "https://example.com/sop.pdf",
  "delivery_time_slots": ["08:00", "13:00", "19:00"],
  "menu_json": {
    "days": []
  },
  "calories": 1800,
  "protein": 120,
  "carbs": 180,
  "fat": 55,
  "created_at": "2026-07-04T10:00:00.000Z",
  "updated_at": "2026-07-04T10:00:00.000Z"
}
```

User listing UI:

- Show plan name.
- Show goal.
- Show `duration_label`.
- Show price.
- Show calories, protein, carbs, and fat when available.
- Hide admin payout fields from customer-facing UI.

## User App: Fuel Plan Detail

```http
GET /fuel/plans/:id
```

Use this for the plan detail page.

Plan detail response includes:

- Plan fields.
- `duration_days`.
- `duration_label`.
- `delivery_time_slots`.
- `menu_json.days`.
- Available chef slots in `slots`.

UI sections:

- Plan name and goal.
- Duration and price.
- Macro summary.
- Description.
- Day-wise menu.
- Available meal delivery times.
- Chef selection.

Recommended day-wise menu UI:

```text
Day 1
  Breakfast 08:00 - Poha with sprouts
  Lunch     13:00 - Rice, dal, sabzi and curd
  Dinner    19:00 - Roti, paneer bhurji and salad
```

## User App: List Chefs For Plan

```http
GET /fuel/plans/:id/chefs?delivery_time_slot=13:00
```

Use this after user selects a meal delivery time.

Response item:

```json
{
  "id": "chef-id",
  "name": "Chef Name",
  "phone": "9999999999",
  "email": "chef@example.com",
  "bio": "Healthy home food specialist",
  "rating": 4.8,
  "is_verified": true,
  "trust_tier": 2,
  "primary_cuisine": "Indian",
  "kitchen_name": "Chef Kitchen",
  "kitchen_address": "Bangalore",
  "latitude": 12.9716,
  "longitude": 77.5946,
  "max_capacity": 10,
  "max_concurrent_slots_per_hour": 15,
  "kitchen_photo_url": "https://example.com/kitchen.jpg",
  "application_status": "APPROVED",
  "plan_id": "plan-id",
  "delivery_time_slot": "13:00"
}
```

UI notes:

- Show chef name, kitchen name, rating, verification, cuisine, and distance if frontend calculates it.
- User must select one chef before subscribing.

## User App: Create Fuel Subscription

```http
POST /fuel/subscriptions
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

Request:

```json
{
  "plan_id": "plan-id",
  "assigned_chef_id": "chef-id",
  "start_date": "2026-07-10",
  "delivery_time_slot": "13:00"
}
```

Rules:

- `start_date` must be a valid date.
- `delivery_time_slot` must exist in the selected plan.
- Selected chef must be enabled for that plan and time slot.
- Backend checks chef capacity.
- If chef is full, backend returns `409`.

Success response:

```json
{
  "id": "subscription-id",
  "user_id": "user-id",
  "plan_id": "plan-id",
  "assigned_chef_id": "chef-id",
  "status": "ACTIVE",
  "start_date": "2026-07-10T00:00:00.000Z",
  "end_date": "2026-07-16T00:00:00.000Z",
  "delivery_time_slot": "13:00",
  "plan": {
    "id": "plan-id",
    "name": "High Protein Vegetarian Plan",
    "duration_days": 7,
    "duration_label": "1 week"
  },
  "assigned_chef": {
    "id": "chef-id",
    "name": "Chef Name",
    "kitchen_name": "Chef Kitchen",
    "phone": "9999999999"
  }
}
```

Important:

- For `duration_days = 3`, backend creates 3 calendar days.
- For `duration_days = 7`, backend creates 7 calendar days.
- For `duration_days = 30`, backend creates 30 calendar days.

## User App: My Fuel Subscriptions

```http
GET /fuel/subscriptions/me
Authorization: Bearer <user_jwt>
```

Use this for the Fuel subscription dashboard.

Response item includes:

- Subscription.
- Plan with `duration_label`.
- Assigned chef.
- Upcoming fulfillments.

Fulfillment status values:

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

UI status mapping:

```text
SCHEDULED -> Upcoming
COOKING -> Being prepared
READY_FOR_PICKUP -> Ready
PICKED_UP -> Out for delivery
DELIVERED -> Delivered
PAUSED -> Paused
MISSED -> Missed
CANCELLED -> Cancelled
```

## User App: Pause Fuel Subscription

```http
POST /fuel/subscriptions/:id/pause
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

Request:

```json
{
  "pause_from": "2026-07-12",
  "pause_to": "2026-07-14"
}
```

Rules:

- Pause requires at least 24 hours notice.
- `pause_to` must be same as or later than `pause_from`.
- Backend marks eligible future fulfillments as `PAUSED`.
- Backend extends subscription `end_date` by the paused day count.

UI notes:

- Disable pause dates inside the next 24 hours.
- Show confirmation before pausing.
- After success, refresh subscription details.

## Chef App: Fuel Plan Catalog

```http
GET /fuel/chef/plans
Authorization: Bearer <chef_jwt>
```

Use this screen to let chefs see plans created by admin.

Response item:

```json
{
  "id": "plan-id",
  "name": "High Protein Vegetarian Plan",
  "duration_days": 7,
  "duration_label": "1 week",
  "delivery_time_slots": ["08:00", "13:00", "19:00"],
  "menu_json": {
    "days": []
  },
  "is_enabled_for_chef": false,
  "chef_slots": []
}
```

UI notes:

- Show duration, macros, menu preview, and available time slots.
- If `is_enabled_for_chef` is false, show an enable action.
- If true, show enabled state and slots.

## Chef App: Enable Fuel Plan

```http
POST /fuel/chef/slots
Authorization: Bearer <chef_jwt>
Content-Type: application/json
```

Request:

```json
{
  "plan_id": "plan-id"
}
```

Behavior:

- Backend creates chef availability slots for every admin-defined `delivery_time_slots`.
- Capacity uses chef profile capacity settings.

## Chef App: My Fuel Slots

```http
GET /fuel/chef/slots
Authorization: Bearer <chef_jwt>
```

Use this to show which Fuel plans/times the chef has enabled.

## Chef App: Fuel Subscriptions Assigned To Chef

```http
GET /fuel/chef/subscriptions
Authorization: Bearer <chef_jwt>
```

Use this for the chef's Fuel subscribers list.

## Chef App: Daily Fuel Fulfillments

```http
GET /fuel/chef/fulfillments?date=2026-07-10
Authorization: Bearer <chef_jwt>
```

Use this for the chef's daily preparation list.

Each fulfillment includes subscription, user, and plan.

## Chef App: Update Fulfillment Status

```http
PATCH /fuel/fulfillments/:id/status
Authorization: Bearer <chef_jwt>
Content-Type: application/json
```

Request:

```json
{
  "status": "READY_FOR_PICKUP"
}
```

Allowed statuses:

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

## Chef App: Submit Weigh-In Proof

```http
POST /fuel/fulfillments/:id/weigh-in
Authorization: Bearer <chef_jwt>
Content-Type: multipart/form-data
```

Form data:

```text
batch_proof: image file
weight_verification_grams: 650
```

Behavior:

- Uploads batch proof photo.
- Stores weight verification.
- Moves fulfillment to `READY_FOR_PICKUP`.

## Fuel NOW: Nearby Chefs

```http
GET /fuel/now/chefs?latitude=12.9716&longitude=77.5946&time_slot=18:00
Authorization: Bearer <user_jwt>
```

Rules:

- Returns approved chefs within 1 km.
- Filters out chefs at capacity.
- Sorts nearest first.

## Fuel NOW: Start Dispatch

```http
POST /fuel/now/dispatch
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

Request:

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "plan_id": "plan-id",
  "item_name": "Protein Bowl",
  "time_slot": "18:00"
}
```

Then poll:

```http
GET /fuel/now/dispatch/:sessionId
Authorization: Bearer <user_jwt>
```

Dispatch status values:

```text
PENDING
OFFERED
ACCEPTED
REJECTED
EXPIRED
NO_CHEF_AVAILABLE
```

## Frontend Screen Checklist

User app:

- Fuel plan listing.
- Fuel plan details.
- Day-wise Breakfast/Lunch/Dinner menu.
- Chef and delivery time selection.
- Subscription confirmation.
- My Fuel subscription dashboard.
- Fulfillment calendar/status view.
- Pause subscription flow.
- Fuel NOW nearby chef search.
- Fuel NOW dispatch status screen.

Chef app:

- Fuel plan catalog.
- Enable Fuel plan.
- Enabled Fuel slots.
- Assigned subscriptions.
- Daily fulfillments.
- Fulfillment status update.
- Weigh-in proof upload.

Admin app:

- Create Fuel plan.
- Select 3 days, 1 week, or 1 month.
- Add Breakfast/Lunch/Dinner menu for every day.
- View created Fuel plans.

## Error Handling

Common errors:

```text
400 Validation failed
400 duration_days must be one of 3, 7, or 30 days
400 Selected delivery_time_slot is not available for this Fuel plan
404 Fuel plan not found
409 Selected chef is not available for this Fuel plan and time slot
409 Chef is at Fuel capacity for this time slot
```

Recommended frontend messages:

```text
Plan not found. Please choose another plan.
This delivery time is not available for the selected plan.
This chef is full for the selected time. Please choose another chef or time.
Please fill breakfast, lunch and dinner for every day.
```
