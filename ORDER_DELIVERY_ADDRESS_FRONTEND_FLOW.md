# Order Delivery Address Frontend Flow

Use this flow when the user chooses the delivery address during checkout.

## 1. Fetch Saved Addresses

```http
GET /api/v1/users/addresses
Authorization: Bearer <token>
```

Show the returned address list on the checkout screen.

## 2. Save New Address If Needed

```http
POST /api/v1/users/addresses
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "label": "Home",
  "address_line": "Plot 24, Jubilee Hills",
  "city": "Hyderabad",
  "state": "Telangana",
  "zip_code": "500033",
  "latitude": 17.4486,
  "longitude": 78.3908,
  "is_default": false
}
```

Save the returned `id`; this is the `delivery_address_id` to send while creating the order.

## 3. Create Cart Checkout Order With Address

Use this for normal cart checkout, including Fuel plan checkout.

```http
POST /api/v1/orders/checkout
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "delivery_address_id": "address_uuid",
  "items": [
    {
      "id": "meal_or_plan_uuid",
      "type": "FUEL_PLAN",
      "quantity": 1,
      "plan_id": "fuel_plan_uuid",
      "assigned_chef_id": "chef_uuid",
      "start_date": "2026-06-10",
      "delivery_time_slot": "13:00"
    }
  ]
}
```

The backend creates one order per chef group and stores the same `delivery_address_id` on each order.

## 4. Legacy Single-Item Order APIs Also Support Address

Meal:

```http
POST /api/v1/orders/meal
```

```json
{
  "mealId": "meal_uuid",
  "quantity": 2,
  "delivery_address_id": "address_uuid"
}
```

Pantry:

```http
POST /api/v1/orders/pantry
```

```json
{
  "itemId": "pantry_item_uuid",
  "quantity": 1,
  "deliveryWindow": "Tomorrow Lunch Batch",
  "delivery_address_id": "address_uuid"
}
```

Social event:

```http
POST /api/v1/orders/social
```

```json
{
  "eventId": "event_uuid",
  "quantity": 1,
  "delivery_address_id": "address_uuid"
}
```

## 5. Validation Rules

- `delivery_address_id` must belong to the logged-in user.
- If the address does not exist or belongs to another user, backend returns `404`.
- If `delivery_address_id` is not sent, the order is created without a per-order address. Delivery dispatch will fall back to the user's default saved address.

## 6. Delivery Dispatch Behavior

When the order is dispatched to Shadowfax, backend uses:

1. `order.delivery_address`, if the order was created with `delivery_address_id`.
2. Otherwise, the user's default saved address.

Frontend recommendation: always send `delivery_address_id` during checkout.
