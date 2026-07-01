# Shadowfax Staging Integration

## Environment

Use these environment variables for the Marketplace staging model:

```env
SHADOWFAX_API_MODE=testing
SHADOWFAX_BASE_URL=https://hlbackend.staging.shadowfax.in
SHADOWFAX_API_TOKEN=<Shadowfax staging token>
SHADOWFAX_CLIENT_CODE=gohomey_mkt
SHADOWFAX_CREDITS_KEY=gohomey_mkt
SHADOWFAX_USE_STAGING_SERVICEABLE_COORDS=true
```

Shadowfax staging serviceability is restricted to Koramangala:

```text
latitude: 12.9379319
longitude: 77.6244159
```

In testing mode, dispatch payloads use these coordinates by default so staging orders can be created successfully. Set `SHADOWFAX_USE_STAGING_SERVICEABLE_COORDS=false` to send actual chef/customer coordinates.

When `SHADOWFAX_USE_STAGING_SERVICEABLE_COORDS=true`, staging dispatch also uses safe Koramangala fallback address text and test phone numbers for incomplete legacy/test orders. Production mode still requires real customer delivery addresses and valid phones.

## Dispatch

Admin dispatch endpoint:

```http
POST /api/v1/admin/deliveries/dispatch-shadowfax
Authorization: Bearer <admin jwt>
Content-Type: application/json

{
  "order_ids": ["optional-order-id"]
}
```

The integration calls the Shadowfax Marketplace endpoint:

```text
POST https://hlbackend.staging.shadowfax.in/api/v2/orders/
```

The integration stores the returned Shadowfax order identifier in `Delivery.external_tracking_id`.

## Live Tracking

The user app can fetch live tracking details by order ID:

```http
GET /api/v1/orders/{order_id}/tracking
Authorization: Bearer <user jwt>
```

Response shape:

```json
{
  "order_id": "order-id",
  "order_status": "OUT_FOR_DELIVERY",
  "delivery_id": "delivery-id",
  "delivery_status": "ASSIGNED",
  "tracking_id": "shadowfax-order-id",
  "tracking_url": "https://...",
  "provider_status": "ALLOTTED",
  "is_live_tracking_available": true
}
```

`tracking_url` is the Shadowfax live map URL. Do not use the Flash tracking endpoint (`/order/track/...`) for Marketplace orders.

For Marketplace orders, the integration now refreshes tracking from:

```text
GET https://hlbackend.staging.shadowfax.in/api/v2/orders/{sfx_order_id}/status/
Authorization: Token <Shadowfax staging token>
```

Shadowfax documents this response as returning `data.status`, `data.track_url`, `data.rider_details`, and ETA fields under `data.order_details`.

## Callback Details

Share this callback URL with Shadowfax for staging status and rider-location callbacks:

```text
https://<your-staging-api-domain>/api/v1/webhooks/shadowfax
```

For local tunnel testing, use:

```text
https://gohomey-dev.loca.lt/api/v1/webhooks/shadowfax
```

The callback endpoint accepts `POST` or `PUT` plain Shadowfax-style payloads:

```json
{
  "coid": "internal-order-id-or-shadowfax-order-id",
  "status": "COLLECTED"
}
```

It also accepts common variants such as `order_id`, `client_order_id`, `sfx_order_id`, `flash_order_id`, `order_status`, `event`, or the same fields nested under `order`, `data`, or `payload`.

Location-only callback payloads are accepted idempotently using `order_id` / `client_order_id` as the order identifier.

Status mapping:

| Shadowfax status                                                                                                               | Internal delivery status |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Shadowfax status                                                                                                               | Internal delivery status |
| ---------------------------------------------------------------------------------------------------------------------          | ------------------------ |
| `CREATED`, `ALLOTTED`, `ALLOTED`, `ACCEPTED`, `ARRIVED`, `ARRIVED_AT_STORE`                                                    | `ASSIGNED`               |
| `COLLECTED`, `DISPATCHED`, `CUSTOMER_DOOR_STEP`, `CUSTOMER_DOORSTEP`, `ARRIVAL_CUSTOMER_DOORSTEP`, `ARRIVED_CUSTOMER_DOORSTEP` | `PICKED_UP`              |
| `DELIVERED`                                                                                                                    | `DELIVERED`              |
| `CANCELLED`, `CANCELLED_BY_CUSTOMER`, `CUSTOMER_RETURN`, `RETURNED`, `RETURNED_TO_SELLER`, `SELLER_RETURN`                     | `FAILED`                 |

If the callback contains `track_url`, `tracking_url`, or `track`, the integration stores it as `Delivery.external_tracking_url`.

## Staging Sandbox Status Updates

Use this admin endpoint to trigger the Shadowfax staging sandbox status APIs from the attached Postman collection:

```http
POST /api/v1/admin/deliveries/{delivery_id}/shadowfax-sandbox-status
Authorization: Bearer <admin jwt>
Content-Type: application/json

{
  "action": "COLLECT"
}
```

Supported actions:

```text
ALLOT
ARRIVE_AT_STORE
COLLECT
CUSTOMER_DOORSTEP
DELIVER
CUSTOMER_RETURN
SELLER_RETURN
```

Optional request fields match the Postman collection, for example `rider_id`, `time_arrival`, `pickup_lat`, `pickup_lng`, `arrival_lat`, `arrival_lng`, `arrival_accuracy`, `delivery_latitude`, `delivery_longitude`, `is_partial_delivery`, `return_reason`, and `rts_order_id`.

For `ALLOT`, the backend sends `only_allot: 1` by default so Shadowfax staging triggers the allot callback.
