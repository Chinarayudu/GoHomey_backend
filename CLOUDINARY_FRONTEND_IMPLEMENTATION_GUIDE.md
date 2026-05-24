# Homey Cloudinary Frontend Implementation Guide

This guide explains how the frontend should handle image and document uploads after the backend moves storage from Render local `/uploads` files to Cloudinary.

## What Changed

Frontend still uploads files to the Homey backend. The frontend does not upload directly to Cloudinary and does not need Cloudinary credentials.

New flow:

```text
Frontend multipart upload -> Homey backend -> Cloudinary -> backend stores Cloudinary secure_url -> frontend displays URL
```

Backend now returns permanent Cloudinary URLs like:

```text
https://res.cloudinary.com/<cloud>/image/upload/...
```

instead of new `/uploads/...` paths.

## Credentials

Frontend must not use these values:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

They are backend-only environment variables.

## Upload Endpoints

Use the same backend endpoints and multipart field names as before.

### 1. Meal Image Upload

Endpoint:

```http
POST /api/v1/meals
Authorization: Bearer <chef_jwt>
Content-Type: multipart/form-data
```

Multipart fields:

```text
meal_name
type
service_window
price
slots_total
date
meal_image
```

`meal_image` is the file field.

Successful response includes:

```json
{
  "status": "success",
  "data": {
    "image_url": "https://res.cloudinary.com/.../homey/meals/..."
  }
}
```

### 2. Chef Registration Documents

Endpoint:

```http
POST /api/v1/chefs/register/step-3
Authorization: Bearer <chef_jwt>
Content-Type: multipart/form-data
```

Multipart file fields:

```text
government_id
food_safety_cert
kitchen_photo
```

Successful response includes:

```json
{
  "data": {
    "government_id_url": "https://res.cloudinary.com/.../homey/chef-documents/...",
    "food_safety_cert_url": "https://res.cloudinary.com/.../homey/chef-documents/...",
    "kitchen_photo_url": "https://res.cloudinary.com/.../homey/chef-documents/..."
  }
}
```

### 3. Batch Proof Upload

Endpoint:

```http
POST /api/v1/meals/:id/proof
Authorization: Bearer <chef_jwt>
Content-Type: multipart/form-data
```

Multipart file field:

```text
batch_proof
```

Successful response includes:

```json
{
  "data": {
    "batch_photo_url": "https://res.cloudinary.com/.../homey/proofs/..."
  }
}
```

### 4. Custom Diet Plan Upload

Endpoint:

```http
POST /api/v1/subscriptions/custom/upload
Authorization: Bearer <user_jwt>
Content-Type: multipart/form-data
```

Multipart file field:

```text
diet_plan
```

Successful response includes:

```json
{
  "file_url": "https://res.cloudinary.com/.../homey/diet-plans/..."
}
```

## React Native Upload Example

```ts
const formData = new FormData();

formData.append('meal_name', mealName);
formData.append('type', 'VEG');
formData.append('service_window', 'DINNER');
formData.append('price', String(price));
formData.append('slots_total', String(slotsTotal));
formData.append('date', dateIsoString);

formData.append('meal_image', {
  uri: image.uri,
  name: image.fileName || 'meal.jpg',
  type: image.type || 'image/jpeg',
} as any);

const response = await api.post('/meals', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});
```

## Display Images

Use the URL from the backend directly:

```tsx
<Image
  source={{ uri: meal.image_url }}
  style={{ width: 120, height: 120 }}
/>
```

Important:

- Always give React Native images fixed width and height.
- Do not prepend the backend domain to Cloudinary URLs.
- If a URL starts with `https://res.cloudinary.com`, use it as-is.

## Open PDFs Or Documents

For PDF/document URLs:

```ts
Linking.openURL(chef.government_id_url);
```

## Backward Compatibility

Old records may still have URLs like:

```text
/uploads/meals/...
/uploads/chef-documents/...
```

The backend currently converts old `/uploads/...` response values to full backend URLs, but those old files may not exist on Render after redeploys.

For old missing images/documents, ask the user/chef/admin to re-upload.

## Frontend Validation

Before rendering:

```ts
const canDisplayImage =
  typeof imageUrl === 'string' &&
  imageUrl.length > 0 &&
  imageUrl.startsWith('https://');
```

Show a placeholder if no valid URL exists.

## Expected Behavior

Cloudinary URLs should normally work immediately after upload. First load can take a second if Cloudinary is generating/cache-optimizing the asset, but it should not take minutes.

## Things The Frontend Should Not Do

- Do not call Cloudinary APIs directly.
- Do not store Cloudinary API keys in frontend code.
- Do not convert Cloudinary URLs into backend `/uploads` URLs.
- Do not assume PDFs are images. Open PDFs with browser/document viewer.

## Backend Deployment Dependency

This frontend flow works only after backend has these environment variables configured on Render:

```text
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
```

If these are missing, upload endpoints will return a backend configuration error.
