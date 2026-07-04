# Order Related Frontend API Guide

Base URL:

```text
https://gohomeyy-backend.onrender.com/api/v1
```

Local URL:

```text
http://localhost:3000/api/v1
```

All protected APIs need:

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## Status Values

Order statuses:

```text
PENDING
CONFIRMED
PREPARING
READY_FOR_PICKUP
OUT_FOR_DELIVERY
DELIVERED
CANCELLED
REFUNDED
```

Delivery statuses:

```text
PENDING
ASSIGNED
PICKED_UP
DELIVERED
FAILED
```

Payment statuses:

```text
PENDING
COMPLETED
FAILED
REFUNDED
```

## User App Order Flow

### 1. Create Order From Cart

Use this as the main checkout API.

```http
POST /orders/checkout
```

Body:

```json
{
  "delivery_address_id": "address-id",
  "items": [
    {
      "id": "meal-or-pantry-or-event-id",
      "type": "DAILY_MEAL",
      "quantity": 1
    }
  ]
}
```

Allowed item types:

```text
DAILY_MEAL
MEAL
PANTRY_ITEM
PANTRY
SOCIAL_EVENT
SOCIAL
FUEL_PLAN
FUEL_SUBSCRIPTION
```

Fuel plan item example:

```json
{
  "delivery_address_id": "address-id",
  "items": [
    {
      "id": "fuel-plan-id",
      "type": "FUEL_PLAN",
      "quantity": 1,
      "plan_id": "fuel-plan-id",
      "assigned_chef_id": "chef-id",
      "start_date": "2026-07-02",
      "delivery_time_slot": "13:00"
    }
  ]
}
```

Response:

```json
{
  "status": "success",
  "message": "1 order(s) created successfully",
  "orders": [
    {
      "id": "order-id",
      "user_id": "user-id",
      "chef_id": "chef-id",
      "delivery_address_id": "address-id",
      "order_type": "DAILY_MEAL",
      "total_price": 250,
      "status": "PENDING",
      "items": [],
      "delivery_address": {}
    }
  ]
}
```

### 2. Legacy Single Order APIs

Use only if the frontend is not using cart checkout.

Meal order:

```http
POST /orders/meal
```

Body:

```json
{
  "mealId": "meal-id",
  "quantity": 1,
  "delivery_address_id": "address-id"
}
```

Pantry order:

```http
POST /orders/pantry
```

Body:

```json
{
  "itemId": "pantry-item-id",
  "quantity": 1,
  "deliveryWindow": "Tomorrow Lunch Batch",
  "delivery_address_id": "address-id"
}
```

Social event order:

```http
POST /orders/social
```

Body:

```json
{
  "eventId": "event-id",
  "quantity": 1,
  "delivery_address_id": "address-id"
}
```

### 3. Create Payment

Call after order creation.

```http
POST /payments/create
```

Body:

```json
{
  "orderId": "order-id"
}
```

Response contains Razorpay order details:

```json
{
  "payment_id": "payment-id",
  "razorpay_order_id": "order_xxx",
  "amount": 26000,
  "amount_rupees": 260,
  "currency": "INR",
  "status": "PENDING"
}
```

### 4. Verify Payment

Call after Razorpay checkout success.

```http
POST /payments/verify
```

Body:

```json
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature"
}
```

After successful verification, backend marks:

```text
payment.status = COMPLETED
order.status = CONFIRMED
```

### 5. Get User Orders

Use for order history, active orders, and order detail screens.

```http
GET /orders/user
```

Response includes:

```text
items
payment
delivery
delivery_address
amount breakdown
```

Frontend usage:

```text
Order history screen: show all orders from this API.
Active orders: filter out DELIVERED / CANCELLED / REFUNDED.
Order detail: find order by id from this list.
```

Note: There is no dedicated `GET /orders/{order_id}` endpoint yet.

### 6. Get Payment Status For Order

```http
GET /payments/orders/{order_id}
```

Use this if the app needs to refresh payment state separately.

### 7. Get Live Delivery Tracking

```http
GET /orders/{order_id}/tracking
```

Response:

```json
{
  "order_id": "order-id",
  "order_status": "OUT_FOR_DELIVERY",
  "delivery_id": "delivery-id",
  "delivery_status": "ASSIGNED",
  "tracking_id": "21045086",
  "tracking_url": "https://order-tracking-hl.staging.shadowfax.in/track/...",
  "provider_status": "ALLOTTED",
  "is_live_tracking_available": true,
  "rider": {
    "name": "Rider Name",
    "phone": "9999999999",
    "latitude": 12.9,
    "longitude": 77.6
  },
  "pickup_eta_minutes": 23,
  "drop_eta_minutes": 33,
  "status_updated": false
}
```

Frontend behavior:

```text
If tracking_url exists: show "Track live order" button.
If rider latitude/longitude exists: show rider location on map.
If is_live_tracking_available is false: show "Tracking will be available after rider assignment".
Poll this API every 20-30 seconds on the tracking screen.
```

## Chef App Order Flow

### 1. Get Chef Orders

All orders for logged-in chef:

```http
GET /orders/chef
```

Active orders:

```http
GET /orders/chef?statusGroup=active
```

Completed orders:

```http
GET /orders/chef?statusGroup=completed
```

Active group includes:

```text
PENDING
CONFIRMED
PREPARING
READY_FOR_PICKUP
OUT_FOR_DELIVERY
```

Completed group includes:

```text
DELIVERED
CANCELLED
REFUNDED
```

Response includes:

```text
items with daily_meal / pantry_item / fuel_slot / social_event
payment
delivery
delivery_address
user name and phone
```

Frontend usage:

```text
New orders tab: filter PENDING / CONFIRMED.
Preparing tab: filter PREPARING.
Ready pickup tab: filter READY_FOR_PICKUP.
Past orders tab: use statusGroup=completed.
Order detail: find order by id from this list.
```

Note: There is no dedicated `GET /orders/chef/{order_id}` endpoint yet.

### 2. Chef Update Order Status

```http
PATCH /orders/{order_id}/status
```

Body:

```json
{
  "status": "PREPARING"
}
```

Allowed statuses:

```text
PENDING
CONFIRMED
PREPARING
READY_FOR_PICKUP
OUT_FOR_DELIVERY
DELIVERED
CANCELLED
REFUNDED
```

Recommended chef workflow:

```text
PENDING -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP
```

Chef app button mapping:

```text
Accept Order -> CONFIRMED
Start Preparing -> PREPARING
Ready For Pickup -> READY_FOR_PICKUP
Cancel Order -> CANCELLED
```

After `READY_FOR_PICKUP`, delivery dispatch is handled from admin/backend. Chef app should not call Shadowfax directly.

### 3. Upload Meal Batch Proof

Use when chef needs to upload proof for a meal batch.

```http
POST /meals/{meal_id}/proof
Content-Type: multipart/form-data
```

Form field:

```text
batch_proof
```

### 4. Fuel Fulfillment Orders For Chef

List daily Fuel fulfillments:

```http
GET /fuel/chef/fulfillments
GET /fuel/chef/fulfillments?date=2026-07-01
```

Update Fuel fulfillment status:

```http
PATCH /fuel/fulfillments/{fulfillment_id}/status
```

Body:

```json
{
  "status": "PREPARING"
}
```

Submit Fuel weigh-in proof:

```http
POST /fuel/fulfillments/{fulfillment_id}/weigh-in
Content-Type: multipart/form-data
```

Form fields:

```text
batch_proof
weight_verification_grams
```

## Screen-To-API Mapping

User app checkout:

```text
POST /orders/checkout
POST /payments/create
POST /payments/verify
GET /orders/user
```

User app order history:

```text
GET /orders/user
```

User app order detail:

```text
GET /orders/user
GET /payments/orders/{order_id}
GET /orders/{order_id}/tracking
```

User app live tracking:

```text
GET /orders/{order_id}/tracking
```

Chef app order dashboard:

```text
GET /orders/chef?statusGroup=active
GET /orders/chef?statusGroup=completed
```

Chef app order detail:

```text
GET /orders/chef
PATCH /orders/{order_id}/status
```

Chef app Fuel orders:

```text
GET /fuel/chef/fulfillments
PATCH /fuel/fulfillments/{fulfillment_id}/status
POST /fuel/fulfillments/{fulfillment_id}/weigh-in
```

## Delivery / Shadowfax Note

Frontend should not call Shadowfax APIs directly.

Frontend should only call:

```http
GET /orders/{order_id}/tracking
```

Backend handles:

```text
Shadowfax status refresh
Shadowfax callback updates
rider details
track_url
delivery status mapping
```

Current Shadowfax callback URL:

```text
https://gohomeyy-backend.onrender.com/api/v1/webhooks/shadowfax
```

This callback URL is for Shadowfax only, not for frontend use.

## APIs To Add Later

These would make frontend implementation cleaner:

```text
GET /orders/{order_id}
GET /orders/chef/{order_id}
PATCH /orders/{order_id}/cancel
GET /orders/{order_id}/timeline
```

Until those exist, use `/orders/user` and `/orders/chef` and filter by `id` on the frontend.
