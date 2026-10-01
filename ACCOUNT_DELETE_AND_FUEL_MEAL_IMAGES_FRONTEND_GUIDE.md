# Account Delete & Fuel Meal Images — Frontend Guide

Two new backend features:

1. **User app** — users can delete their own account.
2. **Admin portal** — admins can upload images for each meal in a Fuel plan. **User and chef apps** get those images in every Fuel response.

Base URL:

```text
https://gohomeyy-backend.onrender.com/api/v1
```

Local development URL:

```text
http://localhost:3000/api/v1
```

---

## 1. Delete Account (User App)

### Endpoint

```http
DELETE /users/profile
Authorization: Bearer <token>
```

No request body.

### Responses

| Status | Meaning | What the app should do |
|---|---|---|
| `204` | Account deleted. Empty body. | Clear the stored token and all cached user data, then go to the login / welcome screen. |
| `409` | Deletion blocked (see below). Body has a `message`. | Show `message` to the user. Keep them logged in. |
| `401` | Token invalid or account already deleted. | Clear the token and go to login. |

`409` example:

```json
{
  "status": "error",
  "message": "You have orders in progress. Please wait until they are delivered or cancelled."
}
```

Deletion is blocked when the user has:

- an order that is `PENDING`, `CONFIRMED`, `PREPARING`, `READY_FOR_PICKUP` or `OUT_FOR_DELIVERY`, or
- a Fuel subscription that is `ACTIVE` or `PAUSED`:

```json
{
  "status": "error",
  "message": "You have an active Fuel subscription. Please cancel it before deleting your account."
}
```

### What happens on the backend

- Name, phone, email and password are erased. Saved addresses, follows and push notification tokens are deleted.
- Past orders are kept (anonymized) for accounting.
- The phone number is freed — the person can sign up again later with the same number as a brand-new user.
- **All existing tokens for the account stop working immediately.**

### Recommended UI

- Put **Delete account** under Profile / Settings, styled as a destructive action.
- Show a confirmation dialog before calling the API, e.g.:
  > Delete your account? Your profile, saved addresses and preferences will be permanently removed. This can't be undone.
- Disable the button while the request is running.

### New `401` code: `ACCOUNT_DELETED` (all apps)

Any authenticated request made with a token of a deleted account now returns:

```json
{
  "status": "error",
  "code": "ACCOUNT_DELETED",
  "message": "This account has been deleted."
}
```

Handle it like the existing `TOKEN_EXPIRED` / `UNAUTHORIZED` codes: clear the token and send the user to login.

### Chef app: users who are also chefs

A chef uses the same login as their user account. If they delete their account from the **user app**:

- Their **chef profile is not deleted** — kitchen, meals, orders and payouts stay.
- The chef app's current session gets `401 ACCOUNT_DELETED` on its next request.
- They log in again with the **same phone number + OTP** and get full chef access back. No re-registration needed.

So the chef app only needs the generic `ACCOUNT_DELETED` → login handling above.

---

## 2. Fuel Meal Images

Each meal in a Fuel plan's menu (per day: `breakfast`, `lunch`, `dinner`) can now have multiple images.

### Admin portal: upload images for a meal

The plan must exist first. Create the plan as today (`POST /fuel/plans`), then upload images per meal.

```http
POST /fuel/plans/:planId/meal-images
Authorization: Bearer <admin token>
Content-Type: multipart/form-data
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `day` | number | yes | Plan day, starting at `1` (matches `menu_json.days[].day`). |
| `period` | string | yes | The meal key in that day: `breakfast`, `lunch` or `dinner`. |
| `images` | file(s) | yes | Up to **10** files per request, **5MB** each. JPEG, PNG or WebP. Repeat the `images` field for multiple files. |

Example (JS):

```js
const form = new FormData();
form.append('day', '1');
form.append('period', 'lunch');
files.forEach((file) => form.append('images', file));

await fetch(`${BASE_URL}/fuel/plans/${planId}/meal-images`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${adminToken}` }, // don't set Content-Type manually
  body: form,
});
```

- Returns `201` with the **full updated plan** (same shape as `GET /fuel/plans/:id`).
- Uploading again **adds** images; it doesn't replace existing ones.
- Errors: `400` (missing day/period/images, or a non-image file), `404` (plan not found, or no such meal for that day/period).

### Admin portal: remove one image

```http
DELETE /fuel/plans/:planId/meal-images
Authorization: Bearer <admin token>
Content-Type: application/json
```

```json
{
  "day": 1,
  "period": "lunch",
  "image_url": "https://res.cloudinary.com/.../homey/fuel/meals/abc.jpg"
}
```

Returns `200` with the full updated plan.

Suggested admin UI: in the day-wise menu editor, show each meal's image thumbnails with an **Add images** button and a remove (×) on each thumbnail.

### User & chef apps: reading the images

Every meal in `menu_json` now always has an `images` array (empty `[]` when none are uploaded):

```json
{
  "menu_json": {
    "days": [
      {
        "day": 1,
        "meals": {
          "breakfast": {
            "name": "Vegetable poha + 2 boiled eggs (450 kcal)",
            "time_slot": "08:00",
            "images": ["https://res.cloudinary.com/.../poha-1.jpg"]
          },
          "lunch": {
            "name": "2 roti + dal + mixed veg + rice + salad (750 kcal)",
            "time_slot": "13:00",
            "images": [
              "https://res.cloudinary.com/.../lunch-1.jpg",
              "https://res.cloudinary.com/.../lunch-2.jpg"
            ]
          },
          "dinner": {
            "name": "2 roti + paneer tikka masala + salad (800 kcal)",
            "time_slot": "19:00",
            "images": []
          }
        }
      }
    ]
  }
}
```

This applies to every response that includes a plan:

| Endpoint | App |
|---|---|
| `GET /fuel/plans` | User |
| `GET /fuel/plans/:id` | User |
| `GET /fuel/subscriptions/me` (inside `plan`) | User |
| `GET /fuel/chef/plans` | Chef |
| `GET /fuel/chef/subscriptions` (inside `plan`) | Chef |

**Daily deliveries** — the resolved `menu` for each delivery also has `images` for that day's meal at the top level:

| Endpoint | App |
|---|---|
| `GET /fuel/deliveries/me` | User |
| `GET /fuel/chef/fulfillments` | Chef |

```json
{
  "id": "…",
  "fulfillment_date": "2026-10-01T00:00:00.000Z",
  "delivery_time_slot": "13:00",
  "menu": {
    "day_number": 1,
    "period": "lunch",
    "item_name": "2 roti + dal + mixed veg + rice + salad (750 kcal)",
    "images": ["https://res.cloudinary.com/.../lunch-1.jpg"],
    "time_slot": "13:00",
    "meals": { "…": "same per-meal shape as above, each with images" },
    "nutrition": { "calories": 1800, "protein": 90, "carbs": 200, "fat": 60 }
  }
}
```

### Display suggestions

- `images.length === 0` → show the existing placeholder / no image.
- `1` → single image.
- `> 1` → swipeable carousel with dots.
- Plan detail screen: show the first image of each meal as a thumbnail in the day-wise menu, and the carousel when the meal is tapped.
- Chef app: show the images on today's fulfillment card so the chef knows how the dish should look.
