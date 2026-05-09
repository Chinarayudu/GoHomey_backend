# Admin API Documentation

All endpoints in this document require a **Bearer Token** with `Role.ADMIN`.
Base path: `/api/v1/admin`

## Table of Contents
- [Platform Statistics](#platform-statistics)
- [Order Management](#order-management)
- [Chef Management](#chef-management)
- [User Management](#user-management)

---

## Platform Statistics

### Get Stats
`GET /stats`
Returns overall platform counts and total revenue.

### Get Daily Revenue
`GET /revenue/daily?days=7`
Returns revenue breakdown per day for the last X days.

---

## Order Management

### List All Orders
`GET /orders`
**Query Params:**
- `status` (Optional): Filter by `OrderStatus` (e.g., `PENDING`, `CONFIRMED`, `DELIVERED`)
- `type` (Optional): Filter by `OrderType` (e.g., `DAILY_MEAL`, `PANTRY_ITEM`)
- `chefId` (Optional)
- `userId` (Optional)

### List Orders Ready for Delivery
`GET /orders/ready`
Returns orders with status `READY_FOR_PICKUP`. These are orders that have been prepared by the chef and are waiting for a delivery partner.

### Get Order Details
`GET /orders/:id`
Returns full details of a specific order, including:
- Customer details & addresses
- Chef details & kitchen address
- Itemized list of meals/products
- Payment status
- Delivery status & tracking info (if assigned)

### Update Order Status (Admin Override)
`PATCH /orders/:id/status`
**Body:**
```json
{
  "status": "CANCELLED"
}
```

---

## Chef Management

### List All Chefs
`GET /chefs`
**Query Params:**
- `applicationStatus` (Optional): Filter by `ChefApplicationStatus` (e.g., `PENDING_REVIEW`, `APPROVED`)
- `isVerified` (Optional): `true` or `false`

### Get Chef Details
`GET /chefs/:id`
Returns full profile, uploaded documents, and recent order history.

### Update Chef Application Status
`PATCH /chefs/:id/application`
Used to approve or reject a chef's application.
**Body:**
```json
{
  "status": "APPROVED",
  "isVerified": true
}
```

---

## User Management

### List All Users
`GET /users`
Returns a list of all registered users (excluding chefs/admins) with their order counts.

---

## Enums Reference

### OrderStatus
`PENDING`, `CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP`, `OUT_FOR_DELIVERY`, `DELIVERED`, `CANCELLED`, `REFUNDED`

### ChefApplicationStatus
`DRAFT`, `PENDING_REVIEW`, `PHONE_VETTING`, `KITCHEN_AUDIT`, `APPROVED`, `REJECTED`
