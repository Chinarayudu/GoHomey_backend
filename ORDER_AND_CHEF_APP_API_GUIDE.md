# Order and Chef App API Guide

Base URL:

```text
https://gohomeyy-backend.onrender.com/api/v1
```

Local URL:

```text
http://localhost:3000/api/v1
```

For protected APIs, send:

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

## User App APIs

### 1. Login / Auth

Use one of these flows.

Password login:

```http
POST /auth/login
```

Body:

```json
{
  "email": "user@example.com",
  "password": "password"
}
```

OTP login:

```http
POST /auth/send-otp
POST /auth/verify-otp
```

Verify OTP body:

```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

Get logged-in profile:

```http
GET /auth/profile
```

### 2. Browse Food / Chefs

List approved chefs:

```http
GET /chefs
```

Get chef details:

```http
GET /chefs/{chef_id}
```

List meals:

```http
GET /meals
GET /meals?date=2026-07-01
GET /meals?chefId={chef_id}
```

Get meal details:

```http
GET /meals/{meal_id}
```

List pantry items:

```http
GET /pantry
GET /pantry?chefId={chef_id}
```

Get pantry item details:

```http
GET /pantry/{item_id}
```

Fuel plan browsing:

```http
GET /fuel/plans
GET /fuel/plans/{plan_id}
GET /fuel/plans/{plan_id}/chefs?delivery_time_slot=13:00
```

### 3. Create Orders

Recommended cart checkout API:

```http
POST /orders/checkout
```

Body for normal items:

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

Fuel subscription checkout item:

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

Single-item legacy order APIs:

```http
POST /orders/meal
POST /orders/pantry
POST /orders/social
```

Meal order body:

```json
{
  "mealId": "meal-id",
  "quantity": 1,
  "delivery_address_id": "address-id"
}
```

Pantry order body:

```json
{
  "itemId": "pantry-item-id",
  "quantity": 1,
  "deliveryWindow": "Tomorrow Lunch Batch",
  "delivery_address_id": "address-id"
}
```

Social order body:

```json
{
  "eventId": "event-id",
  "quantity": 1,
  "delivery_address_id": "address-id"
}
```

### 4. Payment Flow

Create Razorpay payment order:

```http
POST /payments/create
```

Body:

```json
{
  "orderId": "order-id"
}
```

Verify Razorpay payment after checkout success:

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

Get payment status for an order:

```http
GET /payments/orders/{order_id}
```

### 5. User Order List and Details

Get all orders for logged-in user:

```http
GET /orders/user
```

Use this for:

```text
My Orders
Order history
Order cards with payment/delivery/address summary
```

The response includes:

```text
items
payment
delivery
delivery_address
amount breakdown
```

There is no separate user order detail endpoint currently. For an order detail screen, fetch `/orders/user` and select the matching `order.id` on the frontend.

### 6. Live Delivery Tracking

Get live tracking for one order:

```http
GET /orders/{order_id}/tracking
```

Response shape:

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
If tracking_url exists, show "Track live order" button.
If rider latitude/longitude exists, show rider map location.
If is_live_tracking_available is false, show "Tracking will be available after rider assignment".
Refresh this API every 20-30 seconds on the tracking screen.
```

### 7. Fuel User APIs

Create direct Fuel subscription:

```http
POST /fuel/subscriptions
```

List my Fuel subscriptions:

```http
GET /fuel/subscriptions/me
```

Pause Fuel subscription:

```http
POST /fuel/subscriptions/{subscription_id}/pause
```

Fuel NOW:

```http
GET /fuel/now/chefs?latitude=12.9&longitude=77.6
POST /fuel/now/dispatch
GET /fuel/now/dispatch/{dispatch_id}
```

Fuel NOW dispatch body:

```json
{
  "latitude": 12.9379319,
  "longitude": 77.6244159,
  "plan_id": "plan-id",
  "item_name": "High Protein Bowl",
  "time_slot": "13:00"
}
```

## Chef App APIs

### 1. Chef Registration

Step 1, personal information:

```http
POST /chefs/register/step-1
```

Body:

```json
{
  "full_name": "Chef Name",
  "email": "chef@example.com",
  "mobile_number": "+919876543210",
  "primary_cuisine": "South Indian"
}
```

Step 2, kitchen details:

```http
POST /chefs/register/step-2
```

Body:

```json
{
  "kitchen_name": "Chef Kitchen",
  "kitchen_address": "Koramangala, Bengaluru",
  "latitude": 12.9379319,
  "longitude": 77.6244159,
  "max_capacity": 20,
  "appliances": ["Stove", "Oven"]
}
```

Step 3, document upload:

```http
POST /chefs/register/step-3
Content-Type: multipart/form-data
```

Form fields:

```text
government_id
food_safety_cert
kitchen_photo
```

Registration status:

```http
GET /chefs/register/status
```

### 2. Chef Dashboard / Profile

Dashboard:

```http
GET /chefs/dashboard
```

Profile:

```http
GET /chefs/profile
PATCH /chefs/profile
```

Catalog summary for logged-in chef:

```http
GET /chefs/catalog
```

Use `/chefs/catalog` for the chef app home/catalog screen because it returns:

```text
chef
summary
daily_meals
pantry_items
social_events
fuel_slots
```

### 3. Chef Order List

All chef orders:

```http
GET /orders/chef
```

Active orders only:

```http
GET /orders/chef?statusGroup=active
```

Completed/cancelled/refunded orders:

```http
GET /orders/chef?statusGroup=completed
```

Active status group includes:

```text
PENDING
CONFIRMED
PREPARING
READY_FOR_PICKUP
OUT_FOR_DELIVERY
```

Completed status group includes:

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

There is no separate chef order detail endpoint currently. For chef order details, fetch `/orders/chef` and select the matching `order.id` on the frontend.

### 4. Chef Order Status Updates

Update order status:

```http
PATCH /orders/{order_id}/status
```

Body:

```json
{
  "status": "PREPARING"
}
```

Recommended chef workflow:

```text
PENDING -> CONFIRMED -> PREPARING -> READY_FOR_PICKUP
```

After `READY_FOR_PICKUP`, admin dispatches the order to Shadowfax. Then delivery callbacks/tracking move delivery forward.

Use these buttons in chef app:

```text
Accept Order -> CONFIRMED
Start Preparing -> PREPARING
Ready For Pickup -> READY_FOR_PICKUP
Cancel -> CANCELLED
```

### 5. Chef Meal Management

Create meal:

```http
POST /meals
Content-Type: multipart/form-data
```

Form fields:

```text
meal_name
type = VEG | NON_VEG
service_window = LUNCH | DINNER
price
slots_total
date
meal_image
```

Update meal:

```http
PATCH /meals/{meal_id}
```

Delete meal:

```http
DELETE /meals/{meal_id}
```

Upload batch proof photo:

```http
POST /meals/{meal_id}/proof
Content-Type: multipart/form-data
```

Form field:

```text
batch_proof
```

### 6. Chef Pantry Management

Create pantry item:

```http
POST /pantry
Content-Type: multipart/form-data
```

Fields:

```text
name
category
price
inventory
image
```

Update pantry item:

```http
PATCH /pantry/{item_id}
```

Delete pantry item:

```http
DELETE /pantry/{item_id}
```

### 7. Chef Fuel APIs

Chef Fuel plan catalog:

```http
GET /fuel/chef/plans
```

Chef Fuel slots:

```http
GET /fuel/chef/slots
POST /fuel/chef/slots
```

Create/enable Fuel slot body:

```json
{
  "plan_id": "fuel-plan-id",
  "time_slot": "13:00",
  "capacity": 10
}
```

Chef Fuel subscriptions:

```http
GET /fuel/chef/subscriptions
```

Chef daily fulfillments:

```http
GET /fuel/chef/fulfillments
GET /fuel/chef/fulfillments?date=2026-07-01
```

Update fulfillment status:

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

Fuel NOW chef live stream:

```http
GET /fuel/now/chef-stream?token=<chef_jwt>
```

Fuel NOW respond to dispatch:

```http
POST /fuel/now/dispatch/{dispatch_id}/respond
```

Body:

```json
{
  "accepted": true
}
```

## Screen-To-API Mapping

User app home:

```text
GET /chefs
GET /meals
GET /pantry
GET /fuel/plans
```

User app cart checkout:

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
GET /orders/{order_id}/tracking
GET /payments/orders/{order_id}
```

User app live tracking:

```text
GET /orders/{order_id}/tracking
```

Chef app onboarding:

```text
POST /chefs/register/step-1
POST /chefs/register/step-2
POST /chefs/register/step-3
GET /chefs/register/status
```

Chef app dashboard:

```text
GET /chefs/dashboard
GET /orders/chef?statusGroup=active
GET /chefs/catalog
```

Chef app order detail:

```text
GET /orders/chef
PATCH /orders/{order_id}/status
```

Chef app catalog:

```text
GET /chefs/catalog
POST /meals
PATCH /meals/{meal_id}
DELETE /meals/{meal_id}
POST /pantry
PATCH /pantry/{item_id}
DELETE /pantry/{item_id}
GET /fuel/chef/slots
POST /fuel/chef/slots
```

## Delivery / Shadowfax Notes

The frontend should not call Shadowfax directly.

Use this backend API:

```http
GET /orders/{order_id}/tracking
```

The backend handles:

```text
Shadowfax Marketplace status API
status callback updates
rider details
track_url
delivery status mapping
```

Shadowfax callback URL configured on backend:

```text
https://gohomeyy-backend.onrender.com/api/v1/webhooks/shadowfax
```

## Missing APIs To Consider Adding

These are useful frontend conveniences that are not currently present:

```text
GET /orders/{order_id}
GET /orders/chef/{order_id}
PATCH /orders/{order_id}/cancel
PATCH /orders/{order_id}/chef-action
GET /orders/{order_id}/timeline
```

For now, use `/orders/user` and `/orders/chef` and filter by `id` in the frontend.
