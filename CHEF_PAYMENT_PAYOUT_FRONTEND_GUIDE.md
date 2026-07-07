# Chef Payment and Payout Frontend Guide

Base URL:

```text
https://gohomeyy-backend.onrender.com/api/v1
```

Local URL:

```text
http://localhost:3000/api/v1
```

Protected APIs need:

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

## What This Flow Does

Customer payment and chef payout are separate.

Customer payment flow:

```text
Customer pays through Razorpay
Backend marks payment.status = COMPLETED
Backend marks payment.escrow_status = HELD
Order becomes CONFIRMED
```

Chef payout flow:

```text
Order/delivery becomes DELIVERED
Backend creates ChefPayout record
Backend marks payment.escrow_status = RELEASED
Chef can see released earning
Admin manually transfers money to chef
Admin marks payout as PAID
```

Important:

```text
This is an internal payout ledger.
The backend does not automatically transfer money to chef bank yet.
Admin must manually pay the chef outside the system.
```

Manual payment can be done using:

```text
UPI
bank transfer
NEFT / IMPS
RazorpayX dashboard
company bank account
```

## Status Values

Payment statuses:

```text
PENDING
COMPLETED
FAILED
REFUNDED
```

Payment escrow statuses:

```text
PENDING
HELD
RELEASED
REFUNDED
```

Chef payout statuses:

```text
RELEASED
PAID
FAILED
```

Status meaning:

```text
RELEASED = backend says chef is eligible to be paid
PAID = admin manually paid chef and marked it paid
FAILED = admin/manual payout failed or needs attention
```

## When ChefPayout Is Created

Chef payout is created automatically when an order is delivered.

It can be triggered by any of these backend paths:

```text
Delivery callback/status becomes DELIVERED
Chef/admin updates order status to DELIVERED
Admin manually updates order status to DELIVERED
```

Backend behavior:

```text
1. Checks order exists.
2. Checks payment exists.
3. Checks payment.status is COMPLETED.
4. Checks payout does not already exist for the order.
5. Creates ChefPayout.
6. Updates payment.escrow_status to RELEASED.
```

Duplicate delivery callbacks are safe. Backend will not create duplicate payouts.

## Chef App API

### List Chef Payouts

Use this for chef earnings or payout history screen.

```http
GET /payments/chef/payouts
Authorization: Bearer <chef_jwt>
```

Response:

```json
[
  {
    "id": "payout-id",
    "chef_id": "chef-id",
    "order_id": "order-id",
    "payment_id": "payment-id",
    "amount": 250,
    "platform_fee": 20,
    "commission": 0,
    "currency": "INR",
    "status": "RELEASED",
    "release_reason": "DELIVERY_DELIVERED",
    "released_at": "2026-07-07T10:00:00.000Z",
    "paid_at": null,
    "order": {
      "id": "order-id",
      "status": "DELIVERED",
      "total_price": 250,
      "created_at": "2026-07-07T09:00:00.000Z"
    },
    "payment": {
      "id": "payment-id",
      "status": "COMPLETED",
      "escrow_status": "RELEASED",
      "amount": 270,
      "currency": "INR"
    }
  }
]
```

Chef app display logic:

```text
status = RELEASED:
Show "Payment released, pending bank transfer"

status = PAID:
Show "Paid" and display paid_at

status = FAILED:
Show "Payout failed, contact support"
```

Recommended chef earnings summary:

```text
Total released = sum amount where status = RELEASED
Total paid = sum amount where status = PAID
Failed payouts = count where status = FAILED
```

## Admin App APIs

### List Pending Chef Payouts

Use this for admin manual payout screen.

```http
GET /admin/payouts/pending
Authorization: Bearer <admin_jwt>
```

This returns only payouts with:

```text
status = RELEASED
```

Response:

```json
{
  "status": "success",
  "summary": {
    "count": 2,
    "total_amount": 500,
    "currency": "INR"
  },
  "data": [
    {
      "id": "payout-id",
      "status": "RELEASED",
      "amount": 250,
      "currency": "INR",
      "commission": 0,
      "platform_fee": 20,
      "release_reason": "DELIVERY_DELIVERED",
      "released_at": "2026-07-07T10:00:00.000Z",
      "paid_at": null,
      "chef": {
        "id": "chef-id",
        "name": "Chef Name",
        "phone": "+919999999999",
        "email": "chef@example.com",
        "bank_name": "HDFC Bank",
        "bank_account_number": "1234567890",
        "ifsc_code": "HDFC0001234",
        "bank_details_available": true
      },
      "order": {
        "id": "order-id",
        "status": "DELIVERED",
        "order_type": "DAILY_MEAL",
        "total_price": 250,
        "created_at": "2026-07-07T09:00:00.000Z",
        "user": {
          "id": "user-id",
          "name": "Customer Name",
          "phone": "+918888888888"
        }
      },
      "payment": {
        "id": "payment-id",
        "status": "COMPLETED",
        "escrow_status": "RELEASED",
        "amount": 270,
        "currency": "INR",
        "razorpay_order_id": "order_xxx",
        "razorpay_payment_id": "pay_xxx"
      }
    }
  ]
}
```

Admin screen should show:

```text
Chef name
Chef phone
Bank name
Account number
IFSC
Payout amount
Order id
Order total
Payment id
Released date
Bank details available / missing
```

If `bank_details_available` is false:

```text
Disable "Mark Paid"
Show "Bank details missing"
Ask chef/admin to update chef bank details first
```

### Update Payout Status

After admin manually pays chef outside the system, call:

```http
PATCH /admin/payouts/{payout_id}/status
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

Mark as paid:

```json
{
  "status": "PAID"
}
```

Mark as failed:

```json
{
  "status": "FAILED"
}
```

Allowed statuses:

```text
RELEASED
PAID
FAILED
```

When admin sends `PAID`, backend automatically sets:

```text
paid_at = current server time
```

Response:

```json
{
  "id": "payout-id",
  "status": "PAID",
  "amount": 250,
  "currency": "INR",
  "paid_at": "2026-07-07T11:00:00.000Z",
  "chef": {
    "id": "chef-id",
    "name": "Chef Name",
    "phone": "+919999999999",
    "bank_name": "HDFC Bank",
    "bank_account_number": "1234567890",
    "ifsc_code": "HDFC0001234"
  },
  "order": {
    "id": "order-id",
    "status": "DELIVERED",
    "total_price": 250
  },
  "payment": {
    "id": "payment-id",
    "status": "COMPLETED",
    "escrow_status": "RELEASED",
    "amount": 270,
    "currency": "INR"
  }
}
```

## Admin Manual Payout Workflow

Frontend steps:

```text
1. Admin opens payout screen.
2. Call GET /admin/payouts/pending.
3. Show all RELEASED payouts.
4. Admin checks chef bank details.
5. Admin manually transfers money outside app.
6. Admin clicks "Mark Paid".
7. Call PATCH /admin/payouts/{payout_id}/status with PAID.
8. Remove payout from pending list or move to Paid tab.
```

Recommended buttons:

```text
Mark Paid -> PATCH status PAID
Mark Failed -> PATCH status FAILED
Refresh -> GET /admin/payouts/pending
```

## Important Frontend Notes

The frontend should not calculate payout eligibility.

Use backend payout status:

```text
RELEASED = pending manual payment
PAID = payment completed by admin
FAILED = payment failed / needs action
```

The frontend should not call Razorpay payout APIs directly.

Bank transfer is manual for now.

Automatic bank transfer can be added later using:

```text
Razorpay Route
RazorpayX Payouts
another payout provider
```

## Quick API Summary

Chef app:

```http
GET /payments/chef/payouts
```

Admin app:

```http
GET /admin/payouts/pending
PATCH /admin/payouts/{payout_id}/status
```
