# GoHomeyy Fuel User App Guide

This document is only for the customer/user app Fuel screens.

Use this document for the mobile app experience where customers browse Fuel plans, subscribe, pause, track daily fulfillment, and request Fuel NOW.

## Base URL

```text
https://gohomeyy-backend.onrender.com/api/v1
```

## User Flow

1. User opens Fuel.
2. App lists Fuel plans.
3. User views plan details and macros.
4. User selects chef, start date, and delivery time.
5. App creates Fuel subscription.
6. User sees subscription calendar and daily status.
7. User can pause future subscription dates with at least 24 hours notice.
8. For Fuel NOW, user searches nearby chefs and starts live dispatch.

Important:

- Users do not create Fuel plans.
- Users subscribe to GoHomeyy-standardized plans created by admin.
- Delivery partner assignment after `READY_FOR_PICKUP` is not included yet.

## Register Push Token

Call after login if the user app uses push notifications.

```http
POST /notifications/device-token
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios"
}
```

## List Fuel Plans

```http
GET /fuel/plans
```

Use this for the Fuel landing/listing screen.

Response item:

```json
{
  "id": "plan-id",
  "name": "Keto Lean Shred",
  "goal": "WEIGHT_LOSS",
  "description": "Low-carb high-protein standardized plan",
  "price": 5999,
  "duration_days": 30,
  "calories": 1800,
  "protein": 140,
  "carbs": 60,
  "fat": 80
}
```

UI notes:

- Show macro rings for protein, carbs, fat.
- Show plan duration and price.
- Do not show admin-only payout fields in user UI.

## Get Plan Details

```http
GET /fuel/plans/:id
```

Use this for the plan detail page.

## Create Fuel Subscription

```http
POST /fuel/subscriptions
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

```json
{
  "plan_id": "plan-id",
  "assigned_chef_id": "chef-id",
  "start_date": "2026-05-25",
  "delivery_time_slot": "13:00"
}
```

Important:

- Backend checks chef capacity for the selected time slot.
- If chef is full, backend returns `409`.
- Show: `Chef is at capacity for this time slot. Please choose another chef or time.`

## My Fuel Subscriptions

```http
GET /fuel/subscriptions/me
Authorization: Bearer <user_jwt>
```

Use this for the user subscription dashboard and calendar.

Fulfillment status display:

```text
SCHEDULED -> future grey state
COOKING -> live prep state
READY_FOR_PICKUP -> ready state
PICKED_UP -> out for delivery
DELIVERED -> green check
PAUSED -> yellow paused state
MISSED -> issue state
CANCELLED -> cancelled state
```

## Pause Subscription

```http
POST /fuel/subscriptions/:id/pause
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

```json
{
  "pause_from": "2026-05-27",
  "pause_to": "2026-05-30"
}
```

Rules:

- Pause requires at least 24 hours notice.
- Backend marks eligible future rows as `PAUSED`.
- Backend extends the subscription `end_date` by paused days.

UI notes:

- Disable dates within the next 24 hours.
- Show confirmation that paused dates are added to the end.

## Fuel NOW Chef Discovery

```http
GET /fuel/now/chefs?latitude=12.9716&longitude=77.5946
Authorization: Bearer <user_jwt>
```

Rules:

- Returns chefs within 1 km.
- Filters out chefs at capacity.
- Nearest chef appears first.

## Start Fuel NOW Dispatch

```http
POST /fuel/now/dispatch
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

```json
{
  "latitude": 12.9716,
  "longitude": 77.5946,
  "plan_id": "optional-plan-id",
  "item_name": "Protein Macro Bowl",
  "time_slot": "18:00"
}
```

Then poll:

```http
GET /fuel/now/dispatch/:sessionId
Authorization: Bearer <user_jwt>
```

Dispatch statuses:

```text
PENDING
OFFERED
ACCEPTED
REJECTED
EXPIRED
NO_CHEF_AVAILABLE
```

UI notes:

- Show searching while status is `PENDING` or `OFFERED`.
- Poll every 2-3 seconds.
- If `ACCEPTED`, show assigned chef.
- If `NO_CHEF_AVAILABLE`, show unavailable message.

## User App Screen Checklist

- Fuel plan listing screen.
- Fuel plan detail screen.
- Chef/time slot selection screen.
- Subscription confirmation screen.
- My Fuel subscription calendar.
- Pause subscription date picker.
- Fuel NOW searching screen.
- Fuel NOW accepted/unavailable result screen.
