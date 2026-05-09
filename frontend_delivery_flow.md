# End-to-End Order & Delivery Flow (Frontend Integration Guide)

This document provides a clear, step-by-step guide for your frontend web applications (User App, Chef Dashboard, and Admin Dashboard) to execute a complete order lifecycle, from a user adding food to their cart to the Borzo driver dropping it at their door.

---

## Phase 1: The User Places an Order (User App)

The customer browses the app, selects a meal from a Chef, and places the order.

### 1. Place the Order
**API:** `POST /api/v1/orders`
**Auth:** User JWT Token required

```json
// Example Request Payload
{
  "chef_id": "chef-uuid-1234",
  "order_type": "DAILY_MEAL",
  "total_price": 250.00,
  "items": [
    {
      "item_id": "meal-uuid-5678",
      "quantity": 2,
      "price": 125.00
    }
  ]
}
```
**What happens in the backend:** An `Order` record is created with the status `PENDING`.

---

## Phase 2: The Chef Prepares the Food (Chef Dashboard)

The Chef receives the order and confirms they can make it.

### 1. View Incoming Orders
**API:** `GET /api/v1/orders/chef`
**Auth:** Chef JWT Token required
**Result:** Returns an array of orders. The frontend should display orders where `status` is `PENDING`.

### 2. Accept/Confirm the Order
**API:** `PATCH /api/v1/orders/<order_id>/status`
**Auth:** Chef JWT Token required

```json
// Example Request Payload
{
  "status": "CONFIRMED"
}
```
**What happens in the backend:** The order status changes to `CONFIRMED`. *Note: The Chef can also update the status to `PREPARING` or `READY_FOR_PICKUP` later if they want to give the user live kitchen updates.*

---

## Phase 3: The Admin Dispatches the Delivery (Admin Dashboard)

The Admin is responsible for telling the system to grab all ready orders and call Borzo.

### 1. Batch Orders into Deliveries
This is a bulk operation. It finds all orders that are `CONFIRMED` and groups them by Chef so a driver knows where to go.

**API:** `POST /api/v1/delivery/process-batch`
**Auth:** Admin JWT Token required

```json
// No payload required. Just send the POST request.
```
**What happens in the backend:** The system creates a `Delivery` record for those orders. The order status automatically changes to `OUT_FOR_DELIVERY`. The Delivery status is currently `PENDING` (meaning it exists, but no driver is assigned yet).

### 2. Assign the Delivery to Borzo
The Admin views the pending deliveries and clicks "Assign to Borzo".

**API:** `PATCH /api/v1/delivery/<delivery_id>/assign`
**Auth:** Admin JWT Token required

```json
// Example Request Payload
{
  // You can fetch this ID from GET /api/v1/delivery/partners
  "partner_id": "borzo-partner-uuid" 
}
```
**What happens in the backend:** 
1. The backend securely contacts the Borzo API.
2. It books the driver using the Chef's kitchen address and the User's home address.
3. It saves the Borzo tracking link in the database.
4. The Delivery status changes to `ASSIGNED`.

---

## Phase 4: Live Tracking & Automated Updates (Borzo Webhooks)

At this point, the Admin and Chef are completely hands-off. Borzo takes over.

### 1. The Automated Webhook
As the driver moves, Borzo sends hidden HTTP requests to your backend (`POST /api/v1/webhooks/borzo`).
- Driver arrives at the kitchen? Borzo pings you, your Delivery status becomes `PICKED_UP`.
- Driver arrives at the house? Borzo pings you, your Delivery status becomes `DELIVERED`, and the parent Order status also becomes `DELIVERED`.

### 2. Frontend User Tracking
While this is happening, the User wants to see where their food is. Your User App should periodically poll (or load on refresh) the order details.

**API:** `GET /api/v1/orders/<order_id>`
**Auth:** User JWT Token required

```json
// Example Response from the Backend
{
  "id": "order-uuid-1234",
  "status": "OUT_FOR_DELIVERY",
  "delivery": {
    "status": "PICKED_UP",
    "external_tracking_url": "https://borzodelivery.com/track/12345",
    "partner": {
      "name": "Borzo"
    }
  }
}
```

**Frontend Action:** 
If the `delivery.external_tracking_url` is present, show a button that says **"Track Live Delivery"** which opens that Borzo URL in a new browser tab or webview!

---

## Summary of Status Flows

> [!NOTE]
> **Order Status Flow:**
> `PENDING` (User places) ➔ `CONFIRMED` (Chef accepts) ➔ `OUT_FOR_DELIVERY` (Admin batches) ➔ `DELIVERED` (Webhook triggers)

> [!TIP]
> **Delivery Status Flow:**
> *Does not exist* ➔ `PENDING` (Admin batches) ➔ `ASSIGNED` (Admin assigns to Borzo) ➔ `PICKED_UP` (Webhook triggers) ➔ `DELIVERED` (Webhook triggers)
