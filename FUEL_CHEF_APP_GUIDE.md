# GoHomeyy Fuel Chef App Guide

This document is only for the chef app Fuel screens.

Use this document for the chef mobile app experience where chefs view assigned Fuel work, prepare meals, upload weigh-in proof, and respond to Fuel NOW offers.

## Base URL

```text
https://gohomeyy-backend.onrender.com/api/v1
```

## Chef Flow

1. Chef opens Fuel dashboard.
2. App fetches assigned Fuel subscriptions.
3. App fetches daily fulfillment rows.
4. Chef starts cooking.
5. Chef uploads weigh-in proof photo and grams.
6. Backend sets fulfillment to `READY_FOR_PICKUP`.
7. Chef app keeps Fuel NOW live stream open when chef is available.
8. Chef receives Fuel NOW offers with a 120-second countdown.

Important:

- Chefs do not create new Fuel plans.
- Fuel plans are standardized by GoHomeyy/admin.
- Chef responsibility is fulfillment: cooking, proof upload, and readiness.
- Delivery partner pickup after `READY_FOR_PICKUP` will be added later.

## Register Push Token

Call after chef login. This enables prep reminders.

```http
POST /notifications/device-token
Authorization: Bearer <chef_jwt>
Content-Type: application/json
```

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "android"
}
```

If no token is registered, backend logs a mock notification.

## Chef Fuel Subscriptions

```http
GET /fuel/chef/subscriptions
Authorization: Bearer <chef_jwt>
```

Use this for subscriber overview.

## Daily Fulfillment Dashboard

```http
GET /fuel/chef/fulfillments?date=2026-05-25
Authorization: Bearer <chef_jwt>
```

Response item:

```json
{
  "id": "fulfillment-id",
  "fulfillment_date": "2026-05-25T00:00:00.000Z",
  "delivery_time_slot": "13:00",
  "delivery_status": "SCHEDULED",
  "subscription": {
    "user": {
      "name": "Customer",
      "phone": "+91..."
    },
    "plan": {
      "name": "Keto Lean Shred",
      "menu_json": {}
    }
  }
}
```

UI notes:

- Group tasks by `delivery_time_slot`.
- Show plan name, customer, SOP/menu card, and status.
- Show `Start Cooking` for `SCHEDULED`.
- Show weigh-in capture for `COOKING`.

## Update Fulfillment Status

```http
PATCH /fuel/fulfillments/:id/status
Authorization: Bearer <chef_jwt>
Content-Type: application/json
```

```json
{
  "status": "COOKING"
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

Frontend rule:

- Do not let chef manually jump to `READY_FOR_PICKUP`.
- Use weigh-in proof upload for `READY_FOR_PICKUP`.

## Weigh-In Proof Upload

```http
POST /fuel/fulfillments/:id/weigh-in
Authorization: Bearer <chef_jwt>
Content-Type: multipart/form-data
```

Multipart fields:

```text
batch_proof: image file
weight_verification_grams: number
```

Response:

```json
{
  "id": "fulfillment-id",
  "delivery_status": "READY_FOR_PICKUP",
  "chef_batch_photo_url": "https://res.cloudinary.com/...",
  "weight_verification_grams": 450
}
```

UI notes:

- Camera screen should guide chef to frame the food on a weighing scale.
- Ask for grams.
- Submit image and grams together.
- After success, show `Ready for Pickup`.

## Fuel NOW Live Stream

Chef app should connect while chef is online/available.

```http
GET /fuel/now/chef-stream?token=<chef_jwt>
Accept: text/event-stream
```

Events:

```text
connected
fuel_now_offer
fuel_now_countdown
fuel_now_accepted
fuel_now_rejected
fuel_now_expired
```

`fuel_now_offer` example:

```json
{
  "session_id": "dispatch-session-id",
  "expires_at": "2026-05-24T12:00:00.000Z",
  "seconds_to_accept": 120,
  "plan_id": "plan-id",
  "item_name": "Protein Macro Bowl",
  "user_location": {
    "latitude": 12.9716,
    "longitude": 77.5946
  },
  "chef": {
    "id": "chef-id",
    "distance": 0.62
  }
}
```

React Native note:

- Use an EventSource polyfill or fetch-stream library.
- Keep stream open while chef is available.
- Reconnect on app foreground/network recovery.

## Accept Or Reject Fuel NOW Offer

```http
POST /fuel/now/dispatch/:sessionId/respond
Authorization: Bearer <chef_jwt>
Content-Type: application/json
```

Accept:

```json
{
  "accepted": true
}
```

Reject:

```json
{
  "accepted": false
}
```

Rules:

- Chef has 120 seconds.
- If chef rejects or times out, backend cascades to the next eligible chef.

## Prep Reminders

Backend checks every 10 minutes for Fuel fulfillments due around 3 hours later.

If chef has registered an Expo push token, backend sends push:

```text
Fuel prep reminder
```

Chef app does not need to schedule local reminders.

## Chef App Screen Checklist

- Fuel dashboard for today's work.
- Assigned Fuel subscribers list.
- Daily fulfillment list grouped by delivery time.
- SOP/menu detail view.
- Start cooking action.
- Weigh-in camera/upload screen.
- Ready for pickup confirmation state.
- Fuel NOW online toggle.
- Fuel NOW offer modal with 120-second countdown.
- Accept/reject Fuel NOW actions.
