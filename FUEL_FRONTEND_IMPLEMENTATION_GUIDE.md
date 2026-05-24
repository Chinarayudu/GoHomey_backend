# GoHomeyy Fuel Frontend Implementation Guide

This guide explains how the frontend should implement the Fuel subscription experience.

Fuel is different from Daily Meals:

- Daily Meals are chef-created marketplace items.
- Fuel plans are GoHomeyy-standardized nutrition plans.
- Chefs act as fulfillment hubs for standard recipes and SOPs.
- Fuel requires capacity checks, subscription calendars, daily fulfillment status, and chef weigh-in proof.

## Base URL

Development:

```text
http://localhost:3000/api/v1
```

Production:

```text
https://gohomeyy-backend.onrender.com/api/v1
```

## User Fuel Flow

1. User opens Fuel tab.
2. Frontend fetches available Fuel plans.
3. User selects plan and delivery time.
4. Frontend selects an eligible chef/slot.
5. Frontend creates Fuel subscription.
6. Backend generates daily fulfillment rows for the next 48 hours.
7. User sees a subscription calendar and daily status.
8. User can pause subscription with at least 24 hours notice.

## Push Token Registration

The app should register its push token after login. This enables Fuel prep reminders for chefs.

```http
POST /notifications/device-token
Authorization: Bearer <jwt>
Content-Type: application/json
```

Request:

```json
{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "platform": "ios"
}
```

Supported today:

- Expo push tokens starting with `ExponentPushToken`

If no token is registered, backend logs a mock notification so local testing still works.

## Chef Fuel Flow

1. Chef opens Fuel dashboard.
2. Frontend fetches chef subscriptions and daily fulfillment rows.
3. Chef marks fulfillment as `COOKING`.
4. Chef uploads weigh-in proof photo with grams.
5. Backend hard-sets status to `READY_FOR_PICKUP`.
6. Later delivery/admin flow can move it to `PICKED_UP` and `DELIVERED`.

## Admin Fuel Flow

1. Admin creates standardized Fuel plans.
2. Admin can run fulfillment generation manually.
3. Backend also runs fulfillment generation automatically every night at 11:59 PM IST.

## 1. List Fuel Plans

```http
GET /fuel/plans
```

Response:

```json
[
  {
    "id": "plan-id",
    "name": "Keto Lean Shred",
    "goal": "WEIGHT_LOSS",
    "description": "Low-carb high-protein standardized plan",
    "price": 5999,
    "duration_days": 30,
    "price_to_customer": 5999,
    "fixed_chef_payout": 4200,
    "sop_document_url": "https://...",
    "menu_json": {
      "days": []
    },
    "calories": 1800,
    "protein": 140,
    "carbs": 60,
    "fat": 80
  }
]
```

Frontend UI:

- Show plan name, goal, description, macros, price, duration.
- Use macro progress rings for protein/carbs/fat.
- Use `sop_document_url` only for admin/chef reference screens.

## 2. Get Fuel Plan Details

```http
GET /fuel/plans/:id
```

Use this for plan detail page.

## 3. Create Fuel Subscription

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
  "start_date": "2026-05-25",
  "delivery_time_slot": "13:00"
}
```

Response:

```json
{
  "id": "subscription-id",
  "user_id": "user-id",
  "plan_id": "plan-id",
  "assigned_chef_id": "chef-id",
  "status": "ACTIVE",
  "start_date": "2026-05-25T00:00:00.000Z",
  "end_date": "2026-06-23T00:00:00.000Z",
  "delivery_time_slot": "13:00",
  "plan": {},
  "assigned_chef": {}
}
```

Important:

- Backend checks chef Fuel capacity for that time slot.
- If capacity is full, backend returns `409`.
- Frontend should show: `Chef is at capacity for this time slot. Please choose another chef or time.`

## 4. My Fuel Subscriptions

```http
GET /fuel/subscriptions/me
Authorization: Bearer <user_jwt>
```

Response includes recent/upcoming fulfillments:

```json
[
  {
    "id": "subscription-id",
    "status": "ACTIVE",
    "delivery_time_slot": "13:00",
    "plan": {},
    "assigned_chef": {},
    "fulfillments": [
      {
        "id": "fulfillment-id",
        "fulfillment_date": "2026-05-25T00:00:00.000Z",
        "delivery_status": "SCHEDULED",
        "chef_batch_photo_url": null,
        "weight_verification_grams": null
      }
    ]
  }
]
```

Frontend UI:

- Build the subscription calendar from `fulfillments`.
- Green check: `DELIVERED`
- Live tracker: `COOKING`, `READY_FOR_PICKUP`, `PICKED_UP`
- Grey future: `SCHEDULED`
- Yellow paused: `PAUSED`

## 5. Pause Fuel Subscription

```http
POST /fuel/subscriptions/:id/pause
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

Request:

```json
{
  "pause_from": "2026-05-27",
  "pause_to": "2026-05-30"
}
```

Rules:

- Pause requires at least 24 hours notice.
- Backend keeps already-locked meals active.
- Backend marks eligible future fulfillment rows as `PAUSED`.
- Backend extends `end_date` by the number of paused days.

Frontend UI:

- Disable dates less than 24 hours from now.
- Show a confirmation: `Paused days will be added to the end of your plan.`

## 6. Chef Subscriptions

```http
GET /fuel/chef/subscriptions
Authorization: Bearer <chef_jwt>
```

Use this for chef’s Fuel subscriber list.

## 7. Chef Daily Fulfillment Dashboard

```http
GET /fuel/chef/fulfillments?date=2026-05-25
Authorization: Bearer <chef_jwt>
```

Response:

```json
[
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
]
```

Frontend UI:

- Group by `delivery_time_slot`.
- Show customer, plan, SOP/menu card, current status.
- Provide button: `Start Cooking`.

## 8. Update Fulfillment Status

```http
PATCH /fuel/fulfillments/:id/status
Authorization: Bearer <chef_jwt>
Content-Type: application/json
```

Request:

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

Frontend should not let chef manually jump to `READY_FOR_PICKUP`. Use weigh-in upload for that.

## 9. Chef Weigh-In Proof

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

Frontend UI:

- Camera screen with guide overlay.
- Ask chef to place the meal on a digital weighing scale.
- Capture/upload image.
- Ask/input grams.
- Submit both.
- After success, show `Ready for Pickup`.

## 10. Fuel NOW Chef Discovery

```http
GET /fuel/now/chefs?latitude=12.9716&longitude=77.5946
Authorization: Bearer <user_jwt>
```

Response:

```json
[
  {
    "id": "chef-id",
    "name": "Chef Name",
    "kitchen_name": "Kitchen",
    "distance": 0.74,
    "capacity": 15,
    "active_fuel_count": 8,
    "remaining_capacity": 7
  }
]
```

Rules:

- Backend returns chefs within 1 km only.
- Backend filters out chefs at current time-slot capacity.
- Nearest chef appears first.

Frontend UI:

- Use this for Fuel NOW screen.
- Show `Available nearby` only if results exist.
- If empty, show: `No Fuel NOW kitchens available within 1 km.`

## 11. Fuel NOW Live Dispatch Stream

The backend now supports a live chef offer stream for Fuel NOW. It is implemented as a Server-Sent Events stream so the chef app can receive offer/countdown events without polling.

Chef app connects:

```http
GET /fuel/now/chef-stream?token=<chef_jwt>
Accept: text/event-stream
```

Events the chef app should handle:

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

- Standard browser `EventSource` may not be available by default in React Native.
- Use an EventSource polyfill or a fetch-stream package.
- Keep this connection open while the chef is online/available.

Chef accept/reject:

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

If the chef rejects or does not respond within 120 seconds, backend automatically cascades to the next nearest eligible chef within 1 km.

## 12. Start Fuel NOW Dispatch

User app starts dispatch after choosing a Fuel NOW item:

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
  "plan_id": "optional-plan-id",
  "item_name": "Protein Macro Bowl",
  "time_slot": "18:00"
}
```

Response:

```json
{
  "id": "dispatch-session-id",
  "status": "OFFERED",
  "offered_chef_id": "chef-id",
  "candidates": []
}
```

User app can poll status:

```http
GET /fuel/now/dispatch/:sessionId
Authorization: Bearer <user_jwt>
```

Statuses:

```text
PENDING
OFFERED
ACCEPTED
REJECTED
EXPIRED
NO_CHEF_AVAILABLE
```

Frontend behavior:

- Show searching state after starting dispatch.
- Poll every 2-3 seconds until `ACCEPTED` or `NO_CHEF_AVAILABLE`.
- If `ACCEPTED`, show assigned chef and prep timer.
- If `NO_CHEF_AVAILABLE`, show unavailable message.

## 13. Admin Create Fuel Plan

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

## 14. Admin Generate Fulfillment Rows

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

This creates/confirms daily fulfillment rows for active subscriptions.

The backend also runs this automatically every night at **11:59 PM IST** and generates the next 48 hours of Fuel fulfillment rows.

## 15. Chef Prep Reminders

The backend checks every 10 minutes for Fuel fulfillments due around 3 hours later. It sends a chef prep reminder through the backend notification service and marks the fulfillment as reminded.

If the chef has registered an Expo push token using `/notifications/device-token`, the backend sends a real Expo push notification. If not, it logs a mock notification.

Admin/manual test endpoint:

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

Frontend implication:

- Chef app does not need to schedule local reminders.
- When push notification tokens are later wired to FCM/Expo, the same backend trigger will send real push notifications.
- For now, the backend notification service logs/simulates push delivery.

## Status Glossary

Subscription status:

```text
ACTIVE
PAUSED
CANCELLED
COMPLETED
```

Fulfillment status:

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

## Frontend Checklist

- Build Fuel plan listing screen.
- Build Fuel plan detail screen with macro progress rings.
- Build create subscription flow.
- Build user subscription calendar.
- Build pause modal with 24-hour blocked dates.
- Build chef Fuel dashboard grouped by time slot.
- Build chef weigh-in camera/upload screen.
- Build Fuel NOW nearby chef screen.
- Connect chef app to `/fuel/now/chef-stream`.
- Build Fuel NOW offer modal with 120-second countdown.
- Call accept/reject endpoint from the offer modal.
- Poll user dispatch session until accepted/unavailable.
- Use Cloudinary URLs directly for images/documents.
- Handle `409` capacity errors gracefully.

## Pending Future Enhancements

These are not fully implemented yet:

- Full delivery partner dispatch after `READY_FOR_PICKUP`.
- Private signed access for sensitive SOP/documents.
