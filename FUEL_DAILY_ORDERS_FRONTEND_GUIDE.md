# Fuel — Daily Orders Frontend Guide (Chef & User apps)

This describes the APIs for showing **today's Fuel deliveries** in the apps — the Fuel
equivalent of "today's orders." A **chef** sees what to cook/deliver today (with the exact dish)
and updates the status; a **user** sees today's Fuel delivery, which chef is making it, and the
live status.

## Base URL & Auth

```text
Production : https://gohomeyy-backend.onrender.com/api/v1
Local      : http://localhost:3000/api/v1
```

All endpoints below require a JWT:

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

- User endpoints → any logged-in user's token.
- Chef endpoints → a **CHEF**-role token (403 otherwise).

## How the daily menu works (important)

A Fuel plan stores a full **per-day menu** in `menu_json`:

```json
{ "days": [
  { "day": 1, "meals": {
      "breakfast": { "name": "Oats & eggs",         "time_slot": "08:00" },
      "lunch":     { "name": "Grilled chicken bowl", "time_slot": "13:00" },
      "dinner":    { "name": "Paneer & quinoa",      "time_slot": "19:00" } } },
  { "day": 2, "meals": { "...": "..." } }
] }
```

The backend now resolves **which dish is due on a given date** for each subscription and returns it
as a `menu` object on every fulfillment (see below). You do **not** need to compute day numbers on the
frontend — just render `fulfillment.menu`. Rules:
- Day is computed as `days since subscription.start_date`.
- The menu **loops** after the last day (`dayIndex % duration_days`), so long subscriptions keep getting dishes.
- `menu` is `null` if the plan has no `menu_json.days`, or the date is before the subscription start.

### The `menu` object

```json
{
  "day_number": 1,
  "period": "lunch",                     // breakfast | lunch | dinner | null
  "item_name": "Grilled chicken bowl",   // the dish for this delivery slot
  "time_slot": "13:00",
  "meals": { "breakfast": {"name":"...","time_slot":"08:00"},
             "lunch":     {"name":"...","time_slot":"13:00"},
             "dinner":    {"name":"...","time_slot":"19:00"} },
  "nutrition": { "calories": 600, "protein": 40, "carbs": 50, "fat": 20 }
}
```

`period`/`item_name` correspond to the meal whose configured `time_slot` matches the subscription's
`delivery_time_slot`. `meals` is the full day's menu if you want to show all three.

---

## USER APP

### Today's Fuel deliveries — `GET /fuel/deliveries/me`

Returns the logged-in user's Fuel fulfillments for a day (defaults to **today**).

```http
GET /fuel/deliveries/me            # today
GET /fuel/deliveries/me?date=2026-07-11   # specific day (YYYY-MM-DD)
Authorization: Bearer <user_jwt>
```

**Response `200`** — array (empty `[]` if the user has no delivery that day):

```json
[
  {
    "id": "ff-uuid",
    "subscription_id": "sub-uuid",
    "chef_id": "chef-uuid",
    "fulfillment_date": "2026-07-11T00:00:00.000Z",
    "delivery_time_slot": "13:00",
    "delivery_status": "SCHEDULED",
    "chef_batch_photo_url": null,
    "weight_verification_grams": null,
    "created_at": "2026-07-10T18:30:00.000Z",
    "updated_at": "2026-07-10T18:30:00.000Z",
    "menu": {
      "day_number": 1, "period": "lunch", "item_name": "Grilled chicken bowl",
      "time_slot": "13:00", "meals": { "...": "..." },
      "nutrition": { "calories": 600, "protein": 40, "carbs": 50, "fat": 20 }
    },
    "subscription": {
      "id": "sub-uuid", "plan_id": "plan-uuid", "assigned_chef_id": "chef-uuid",
      "status": "ACTIVE",
      "start_date": "2026-07-11T00:00:00.000Z",
      "end_date": "2026-07-13T00:00:00.000Z",
      "delivery_time_slot": "13:00",
      "assigned_chef": { "id": "chef-uuid", "name": "Chef Arun",
                         "kitchen_name": "Arun's Kitchen", "phone": "+9199..." },
      "plan": { "id": "plan-uuid", "name": "Lean 3-Day", "goal": "Fat loss",
                "duration_days": 3, "duration_label": "3 days", "price": 999,
                "calories": 600, "protein": 40, "carbs": 50, "fat": 20,
                "menu_json": { "days": ["..."] } }
    }
  }
]
```

**Suggested UI:** a "Today's Fuel" card per item → `menu.item_name`, `delivery_time_slot`,
`delivery_status` badge, chef name (`subscription.assigned_chef.name`), and nutrition.

> For the user's full subscription list (all subscriptions + upcoming fulfillments), keep using the
> existing `GET /fuel/subscriptions/me`.

---

## CHEF APP

### Today's cook/deliver list — `GET /fuel/chef/fulfillments`

Returns the chef's Fuel fulfillments for a day. **Now includes the `menu` (dish to cook) and the customer.**

```http
GET /fuel/chef/fulfillments?date=2026-07-11   # YYYY-MM-DD; omit for all dates
Authorization: Bearer <chef_jwt>
```

**Response `200`** — array:

```json
[
  {
    "id": "ff-uuid",
    "subscription_id": "sub-uuid",
    "chef_id": "chef-uuid",
    "fulfillment_date": "2026-07-11T00:00:00.000Z",
    "delivery_time_slot": "13:00",
    "delivery_status": "SCHEDULED",
    "chef_batch_photo_url": null,
    "weight_verification_grams": null,
    "menu": {
      "day_number": 1, "period": "lunch", "item_name": "Grilled chicken bowl",
      "time_slot": "13:00", "meals": { "...": "..." },
      "nutrition": { "calories": 600, "protein": 40, "carbs": 50, "fat": 20 }
    },
    "subscription": {
      "id": "sub-uuid", "status": "ACTIVE",
      "start_date": "2026-07-11T00:00:00.000Z", "end_date": "2026-07-13T00:00:00.000Z",
      "delivery_time_slot": "13:00",
      "user": { "id": "user-uuid", "name": "Ravi", "phone": "+9199..." },
      "plan": { "id": "plan-uuid", "name": "Lean 3-Day", "duration_days": 3, "menu_json": {"...": "..."} }
    }
  }
]
```

**Suggested UI:** group by `delivery_time_slot`; each row shows `menu.item_name` (what to cook),
quantity is always 1 per fulfillment, customer `subscription.user.name` + `phone`, and a status control.

### Update delivery status — `PATCH /fuel/fulfillments/{id}/status`

Chef (or admin) moves a fulfillment through its lifecycle.

```http
PATCH /fuel/fulfillments/ff-uuid/status
Authorization: Bearer <chef_jwt>

{ "status": "COOKING" }
```

**Allowed `status` values:**

```text
SCHEDULED  COOKING  READY_FOR_PICKUP  PICKED_UP  DELIVERED  PAUSED  MISSED  CANCELLED
```

Invalid value → `400` (validation error). **Response `200`** = the updated fulfillment row.

**Recommended chef flow:**

```text
SCHEDULED  →  COOKING  →  (weigh-in)  →  READY_FOR_PICKUP  →  PICKED_UP  →  DELIVERED
```

### Batch weigh-in proof — `POST /fuel/fulfillments/{id}/weigh-in`

Optional step: chef uploads a batch photo + weight; backend stores them and sets the status to
`READY_FOR_PICKUP`. **Multipart form-data** (not JSON):

```http
POST /fuel/fulfillments/ff-uuid/weigh-in
Authorization: Bearer <chef_jwt>
Content-Type: multipart/form-data

batch_proof: <image file>                 # required
weight_verification_grams: 850            # required, positive integer
```

**Response `200`** = updated fulfillment (`chef_batch_photo_url`, `weight_verification_grams` set,
`delivery_status = READY_FOR_PICKUP`).

---

## Status reference

**Fuel fulfillment (`delivery_status`)** — show as a badge:

| Value | Meaning (suggested label) |
|---|---|
| `SCHEDULED` | Scheduled |
| `COOKING` | Cooking |
| `READY_FOR_PICKUP` | Ready for pickup |
| `PICKED_UP` | Picked up |
| `DELIVERED` | Delivered |
| `PAUSED` | Paused |
| `MISSED` | Missed |
| `CANCELLED` | Cancelled |

## Notes / edge cases

- Fulfillment rows are generated for a rolling 2-day window (nightly + on subscribe/payment). A chef/user
  querying far-future dates may get `[]` until rows are generated.
- `menu` is `null` when the plan has no `menu_json.days` or the queried date precedes `subscription.start_date`.
- `fulfillment_date` is midnight UTC; compare by calendar day, not exact time.
- Times (`delivery_time_slot`, `time_slot`) are plain `"HH:mm"` strings defined by the plan.

## Quick summary

```http
# User app
GET  /fuel/deliveries/me?date=YYYY-MM-DD        # today's Fuel delivery (+ resolved dish, chef, status)
GET  /fuel/subscriptions/me                     # (existing) all my subscriptions + upcoming fulfillments

# Chef app
GET   /fuel/chef/fulfillments?date=YYYY-MM-DD   # today's cook/deliver list (+ resolved dish, customer)
PATCH /fuel/fulfillments/{id}/status            # { status } — update delivery status
POST  /fuel/fulfillments/{id}/weigh-in          # multipart batch_proof + weight_verification_grams
```
