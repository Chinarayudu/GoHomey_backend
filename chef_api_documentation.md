# Chef Dashboard API Documentation

This document provides a comprehensive guide to the backend endpoints required to build the **Chef Dashboard** and related screens (Orders, Meals, and Profile).

**Base URL**: `http://localhost:3000/api/v1`

---

## Authentication

All requests below require a **Bearer Token** in the `Authorization` header.

| Header | Value |
|---|---|
| `Authorization` | `Bearer <JWT_TOKEN>` |
| `Content-Type` | `application/json` (or `multipart/form-data` where specified) |

> [!IMPORTANT]
> All Chef dashboard endpoints require the token's user to have the `CHEF` role. You get this token from the `/auth/verify-otp` response after OTP verification.

---

## 1. Dashboard Statistics

### `GET /chefs/dashboard`
Returns high-level stats for the logged-in chef — earnings, order count, and active meal slots for today.

**Request**
```http
GET /api/v1/chefs/dashboard
Authorization: Bearer <token>
```

**Response `200`**
```json
{
  "status": "success",
  "data": {
    "earnings_today": 1250.50,
    "orders_count_today": 8,
    "active_slots_count": 2,
    "active_slots": [
      {
        "id": "uuid-of-slot",
        "meal_name": "Paneer Butter Masala",
        "type": "VEG",
        "service_window": "LUNCH",
        "image_url": "/uploads/meals/abc.jpg",
        "slots_remaining": 5,
        "slots_total": 10,
        "price": 150.00,
        "date": "2024-04-12T00:00:00.000Z"
      }
    ]
  }
}
```

---

## 2. Order Management

### `GET /orders/chef`
Fetch all orders assigned to the logged-in chef, optionally filtered by status group.

**Request**
```http
GET /api/v1/orders/chef?statusGroup=active
Authorization: Bearer <token>
```

**Query Parameters**

| Param | Type | Description |
|---|---|---|
| `statusGroup` | `active` \| `completed` | `active` = RECEIVED, COOKING, READY_FOR_PICKUP. `completed` = DELIVERED, CANCELLED |

**Response `200`**
```json
{
  "status": "success",
  "data": [
    {
      "id": "order-uuid",
      "total_price": 450.00,
      "status": "RECEIVED",
      "created_at": "2024-04-12T05:00:00.000Z",
      "items": [
        { "meal_name": "Dal Rice", "quantity": 2, "price": 225 }
      ],
      "user": { "name": "Ravi Kumar" }
    }
  ]
}
```

---

### `PATCH /orders/:id/status`
Update the status of a specific order (e.g., start cooking, mark as ready for pickup).

**Request**
```http
PATCH /api/v1/orders/order-uuid/status
Authorization: Bearer <token>
Content-Type: application/json

{ "status": "COOKING" }
```

**Allowed Status Transitions**

| Status | Meaning |
|---|---|
| `RECEIVED` | Order just placed by the customer |
| `COOKING` | Chef has started preparing |
| `READY_FOR_PICKUP` | Batch is done, ready to be picked up |
| `OUT_FOR_DELIVERY` | Delivery partner picked it up |
| `DELIVERED` | Customer received the order |
| `CANCELLED` | Order was cancelled |

**Response `200`**
```json
{ "id": "order-uuid", "status": "COOKING", "updated_at": "..." }
```

---

## 3. Meal Slot Management

### `POST /meals`
Create a new meal slot for a specific date and time window.

**Request** (`multipart/form-data`)
```http
POST /api/v1/meals
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `meal_name` | `string` | ✅ | Name of the dish |
| `type` | `VEG` \| `NON_VEG` | ✅ | Food type |
| `service_window` | `LUNCH` \| `DINNER` | ✅ | Time slot |
| `price` | `number` | ✅ | Price per serving |
| `slots_total` | `integer` | ✅ | Max servings available |
| `date` | `string` (ISO) | ✅ | Date of the meal (e.g., `2024-04-13`) |
| `meal_image` | `file` | ❌ | Image of the dish (JPEG/PNG/WebP) |

**Response `201`**
```json
{
  "status": "success",
  "data": {
    "id": "meal-uuid",
    "meal_name": "Chole Bhature",
    "slots_total": 10,
    "slots_remaining": 10,
    "price": 120.00,
    "date": "2024-04-13T00:00:00.000Z"
  }
}
```

---

### `POST /meals/:id/proof`
Upload a photo as proof that the meal batch is prepared and ready.

**Request** (`multipart/form-data`)
```http
POST /api/v1/meals/meal-uuid/proof
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Fields**

| Field | Type | Required | Description |
|---|---|---|---|
| `batch_proof` | `file` | ✅ | Photo of the cooked batch (JPEG/PNG/WebP) |

**Response `200`**
```json
{
  "status": "success",
  "message": "Batch proof uploaded successfully",
  "data": { "batch_photo_url": "/uploads/proofs/xyz.jpg" }
}
```

---

## 4. Profile & Bank Details

### `GET /chefs/profile`
Retrieve the logged-in chef's public profile, kitchen info, and bank details.

**Request**
```http
GET /api/v1/chefs/profile
Authorization: Bearer <token>
```

**Response `200`**
```json
{
  "status": "success",
  "data": {
    "id": "chef-uuid",
    "name": "Chef Auguste",
    "email": "auguste@cuisine.com",
    "phone": "+919876543210",
    "bio": "Expert in South Indian home cooking",
    "rating": 4.8,
    "is_verified": true,
    "primary_cuisine": "South Indian",
    "kitchen_name": "Auguste's Kitchen",
    "kitchen_address": "122 Artisan Way, Hyderabad",
    "max_capacity": 12,
    "kitchen_photo_url": "/uploads/chef-documents/kitchen.jpg",
    "bank_name": "HDFC Bank",
    "bank_account_number": "XXXXXXX9012",
    "ifsc_code": "HDFC0001234"
  }
}
```

---

### `PATCH /chefs/profile`
Update the chef's bio, kitchen details, or bank information.

**Request**
```http
PATCH /api/v1/chefs/profile
Authorization: Bearer <token>
Content-Type: application/json
```

**Body** (all fields optional)
```json
{
  "name": "Chef Auguste Escoffier",
  "bio": "Updated bio here",
  "kitchen_name": "New Kitchen Name",
  "kitchen_address": "Updated address",
  "bank_name": "ICICI Bank",
  "bank_account_number": "987654321",
  "ifsc_code": "ICIC0001234"
}
```

**Response `200`**
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": { "...updated chef fields..." }
}
```

---

## Error Reference

| Code | Reason |
|---|---|
| `401 Unauthorized` | Token is missing, invalid, or expired |
| `403 Forbidden` | User does not have the `CHEF` role or no chef profile found |
| `400 Bad Request` | Validation failure — a required field is missing or invalid |
| `404 Not Found` | The specified order or meal ID does not exist |
| `500 Internal Server Error` | Server-side failure |
