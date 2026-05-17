# Homey Razorpay Payment Integration Guide

This document explains the current payment flow for the frontend team.

## Current Backend Status

The backend now creates real Razorpay test-mode orders, verifies Razorpay Checkout signatures, stores Razorpay references separately, and updates Homey order/payment status after successful payment.

The Razorpay test keys are configured in the backend `.env`. The frontend must not hardcode the secret key. It only receives the public `razorpay_key_id` from the backend response.

Official references:

- Razorpay Orders API: https://razorpay.com/docs/api/orders/create/
- Razorpay Checkout integration: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
- Razorpay payment verification: https://razorpay.com/docs/payments/server-integration/nodejs/integration-steps/#15-verify-payment-signature
- Razorpay webhooks: https://razorpay.com/docs/webhooks/validate-test/

## High-Level Flow

1. User creates an order in Homey.
2. Frontend calls Homey backend to create a Razorpay order.
3. Backend creates the Razorpay order and stores a local `Payment` row as `PENDING`.
4. Frontend opens Razorpay Checkout.
5. Razorpay returns `razorpay_order_id`, `razorpay_payment_id`, and `razorpay_signature`.
6. Frontend sends those three values to the backend.
7. Backend verifies the signature.
8. Backend marks payment as `COMPLETED`.
9. Backend marks the Homey order as `CONFIRMED`.

## API Base URL

Development:

```text
http://localhost:3000/api/v1
```

Production:

```text
https://YOUR_BACKEND_DOMAIN/api/v1
```

## 1. Create Payment

Use this after the Homey order has been created.

```http
POST /payments/create
Authorization: Bearer <user_jwt>
Content-Type: application/json
```

Request:

```json
{
  "orderId": "homey-order-uuid"
}
```

Success response:

```json
{
  "payment_id": "local-payment-uuid",
  "razorpay_order_id": "order_RAZORPAY_ID",
  "razorpay_key_id": "rzp_test_xxxxx",
  "amount": 24900,
  "amount_rupees": 249,
  "currency": "INR",
  "status": "PENDING"
}
```

Important:

- `amount` is in paise because Razorpay Checkout expects paise.
- `amount_rupees` is only for display/debugging.
- `razorpay_key_id` is safe for the frontend.
- Never expose `RAZORPAY_KEY_SECRET` in frontend code.

## 2. Open Razorpay Checkout

Load the Razorpay Checkout script in the frontend:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

Example:

```ts
const paymentResponse = await api.post('/payments/create', {
  orderId,
});

const options = {
  key: paymentResponse.razorpay_key_id,
  amount: paymentResponse.amount,
  currency: paymentResponse.currency,
  name: 'Homey',
  description: 'Home-cooked meal order',
  order_id: paymentResponse.razorpay_order_id,
  handler: async function (response) {
    await api.post('/payments/verify', {
      razorpay_order_id: response.razorpay_order_id,
      razorpay_payment_id: response.razorpay_payment_id,
      razorpay_signature: response.razorpay_signature,
    });

    // After success, refresh order details.
    // The order status should become CONFIRMED.
  },
  prefill: {
    name: user.name,
    email: user.email,
    contact: user.phone,
  },
  theme: {
    color: '#111827',
  },
};

const razorpay = new window.Razorpay(options);
razorpay.open();
```

## 3. Verify Payment

The frontend must call this from the Razorpay `handler`.

```http
POST /payments/verify
Content-Type: application/json
```

Request:

```json
{
  "razorpay_order_id": "order_RAZORPAY_ID",
  "razorpay_payment_id": "pay_RAZORPAY_ID",
  "razorpay_signature": "checkout_signature"
}
```

Success response:

```json
{
  "success": true,
  "payment": {
    "id": "local-payment-uuid",
    "order_id": "homey-order-uuid",
    "amount": 249,
    "currency": "INR",
    "status": "COMPLETED",
    "gateway_id": "order_RAZORPAY_ID",
    "razorpay_order_id": "order_RAZORPAY_ID",
    "razorpay_payment_id": "pay_RAZORPAY_ID",
    "escrow_status": "HELD"
  },
  "order": {
    "id": "homey-order-uuid",
    "status": "CONFIRMED"
  }
}
```

Frontend behavior after success:

- Show payment success.
- Refresh the order.
- Move the user to order tracking/order confirmation.
- Do not mark payment successful only from the Razorpay popup. Trust the backend verification response.

## 4. Get Payment Status

Use this when the frontend needs to refresh payment state.

```http
GET /payments/orders/:orderId
Authorization: Bearer <user_jwt>
```

Success response:

```json
{
  "id": "local-payment-uuid",
  "order_id": "homey-order-uuid",
  "amount": 249,
  "currency": "INR",
  "status": "COMPLETED",
  "razorpay_order_id": "order_RAZORPAY_ID",
  "razorpay_payment_id": "pay_RAZORPAY_ID",
  "escrow_status": "HELD",
  "order": {
    "id": "homey-order-uuid",
    "status": "CONFIRMED",
    "total_price": 249
  }
}
```

## 5. Payment Failure Handling

Razorpay Checkout can fail or be closed by the user.

Frontend should:

- Keep the Homey order as `PENDING`.
- Show retry payment option.
- Call `/payments/create` again for the same order.

The backend returns the existing pending Razorpay order if one already exists.

Example:

```ts
razorpay.on('payment.failed', function (response) {
  // Show failure message.
  // Keep retry button visible.
  // Do not call /payments/verify.
});
```

## 6. Razorpay Webhook

Backend endpoint:

```http
POST /payments/webhook/razorpay
```

Recommended Razorpay dashboard events:

- `payment.captured`
- `payment.failed`
- `order.paid`
- `refund.processed`

Webhook behavior:

- `payment.captured` or `order.paid`: payment becomes `COMPLETED`, order becomes `CONFIRMED`.
- `payment.failed`: payment becomes `FAILED`.
- `refund.processed`: payment becomes `REFUNDED`, order becomes `REFUNDED`.

For local webhook testing, expose the backend using the existing tunnel script:

```text
npm run tunnel
```

Then configure Razorpay webhook URL:

```text
https://gohomey-dev.loca.lt/api/v1/payments/webhook/razorpay
```

Set the same webhook secret in Razorpay dashboard and backend `.env`:

```text
RAZORPAY_WEBHOOK_SECRET=<secret-generated-in-razorpay-dashboard>
```

## 7. Test Mode

Use Razorpay Test Mode until production launch.

The backend currently uses test credentials. Later, when the client/company account is ready, replace only these environment variables:

```text
RAZORPAY_KEY_ID=<client_live_key_id>
RAZORPAY_KEY_SECRET=<client_live_key_secret>
RAZORPAY_WEBHOOK_SECRET=<client_live_webhook_secret>
```

No frontend code change should be needed if the frontend uses `razorpay_key_id` from `/payments/create`.

## 8. Frontend Checklist

- Create Homey order first.
- Call `/payments/create` with the Homey order id.
- Open Razorpay Checkout using backend response.
- Send Razorpay handler response to `/payments/verify`.
- Treat backend verify success as the only real payment success.
- Refresh order details after payment.
- Show retry payment if Razorpay popup is closed or payment fails.
- Never store or expose Razorpay key secret.

## 9. Pending Backend Work For Later

These are not required for basic test payments but should be added before full production:

- Refund initiation API.
- Chef payout/release workflow.
- Admin payment reconciliation screen.
- Better auth/ownership validation on `/payments/verify`.
- Production Razorpay webhook secret.
- Automated delivery partner integration after payment confirmation.
