# GoHomeyy API Documentation

Welcome to the GoHomeyy API documentation! This backend serves a marketplace for home-prepared meals, pantry items, and subscriptions.

## 🚀 Getting Started

### Base URL
The backend is currently exposed via Localtunnel. Use the following URL as your base:
**`https://gohomey-dev.loca.lt/api/v1`**

> [!IMPORTANT]
> When your friend visits this URL for the first time, they might see a "Localtunnel" landing page. They should click **"Click to Continue"** or enter the backend laptop's public IP address to proceed.

---

## 🔐 Authentication

Most endpoints require a **Bearer Token**.

### 1. Registration
- **URL**: `/auth/register`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword",
    "firstName": "John",
    "lastName": "Doe"
  }
  ```

### 2. Login
- **URL**: `/auth/login`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
- **Response**: Returns an `access_token`.

### 3. Using the Token
Include the token in the `Authorization` header for all protected requests:
`Authorization: Bearer <your_access_token>`

---

## 🥗 Meal Management

### Create a Meal (Chef Only)
- **URL**: `/meals`
- **Method**: `POST`
- **Auth**: Chef Role Required
- **Body**:
  ```json
  {
    "title": "Butter Chicken",
    "description": "Authentic home-cooked butter chicken with basmati rice.",
    "price": 15.99,
    "categoryId": "category-uuid",
    "availableQuantity": 20,
    "images": ["url1", "url2"]
  }
  ```

### Get All Meals
- **URL**: `/meals`
- **Method**: `GET`
- **Query Params**: `date` (optional), `chefId` (optional)

### Get Meal Details
- **URL**: `/meals/:id`
- **Method**: `GET`

---

## 👨‍🍳 Chef Management

### Apply to be a Chef
- **URL**: `/chefs/apply`
- **Method**: `POST`
- **Auth**: User Session Required
- **Body**:
  ```json
  {
    "bio": "Passionate home cook specializing in North Indian cuisine."
  }
  ```

### Get All Chefs
- **URL**: `/chefs`
- **Method**: `GET`

---

## 🛍️ Ordering

### Create Meal Order
- **URL**: `/orders/meal`
- **Method**: `POST`
- **Auth**: User Session Required
- **Body**:
  ```json
  {
    "mealId": "meal-uuid",
    "quantity": 2
  }
  ```

### Get My Orders
- **URL**: `/orders/user`
- **Method**: `GET`
- **Auth**: User Session Required

---

## 📅 Subscriptions (Fuel Plans)

### Get All Fuel Plans
- **URL**: `/subscriptions/plans`
- **Method**: `GET`

### Create a Slot (Chef Only)
- **URL**: `/subscriptions/slots`
- **Method**: `POST`
- **Auth**: Chef Role Required
- **Body**:
  ```json
  {
    "planId": "plan-uuid",
    "maxSubscribers": 10,
    "deliveryDays": ["Mon", "Wed", "Fri"]
  }
  ```

---

## 💳 Payments

### Initiate Payment
- **URL**: `/payments/create`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "orderId": "order-uuid"
  }
  ```

---

## 🛠️ Admin

### Get Stats
- **URL**: `/admin/stats`
- **Method**: `GET`
- **Auth**: Admin Role Required
