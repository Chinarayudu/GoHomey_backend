# COMPLETE FRONTEND API SPECIFICATION & INTEGRATION GUIDE

This document provides all the technical details required for the frontend team to implement the Hyperlocal Location, Delivery Radius, and Account Synchronization features.

---

## 1. Authentication & Identity
When a user logs in via OTP, the backend identifies if they are a User, a Chef, or both.

### **POST `/api/v1/auth/verify-otp`**
**Request Body:**
```json
{
  "phone": "+919876543210",
  "otp": "123456"
}
```

**Response Payload:**
```json
{
  "status": "success",
  "data": {
    "isNewUser": false,
    "isChef": true,
    "applicationStatus": "APPROVED",
    "registrationStep": 4,
    "redirectToStatus": false,
    "token": "JWT_TOKEN_STRING",
    "latitude": 17.4486,
    "longitude": 78.3908
  }
}
```
> **Logic**: 
> - If `isChef` is true, direct the user to the Chef Dashboard.
> - Use `latitude`/`longitude` to initialize the "Delivery Spot" on the home screen.

---

## 2. Location Management (The "Active" Spot)
The app must tell the backend where the user is currently located. This enables the 3km radius filtering.

### **PATCH `/api/v1/users/location`**
Call this API whenever the user clicks "Use My Current Location" or selects an address from their list.

**Request Body:**
```json
{
  "latitude": 17.4486,
  "longitude": 78.3908
}
```

**Response Payload:**
```json
{
  "status": "success",
  "message": "Location updated",
  "data": {
    "user": {
      "id": "user_uuid",
      "latitude": 17.4486,
      "longitude": 78.3908
    },
    "matchedAddress": {
      "id": "address_uuid",
      "label": "Home",
      "address_line": "Plot 24, Jubilee Hills",
      "city": "Hyderabad",
      "latitude": 17.4485,
      "longitude": 78.3907
    }
  }
}
```

### **Frontend Logic (The 100m Rule):**
- If `matchedAddress` **is NOT null**: The user is at one of their saved spots. Display the label (e.g., "Delivering to Home").
- If `matchedAddress` **is null**: The user is at a new spot. Ask the user: *"We don't recognize this place. Want to save it as a new address?"*

---

## 3. Saving a New Address (Address Book)
When a user decides to save their current spot permanently.

### **POST `/api/v1/users/addresses`**
**Request Body:**
```json
{
  "label": "Work",
  "address_line": "Hitech City, Phase 2",
  "city": "Hyderabad",
  "state": "Telangana",
  "zip_code": "500081",
  "latitude": 17.4411,
  "longitude": 78.3922,
  "is_default": true
}
```

---

## 4. Hyperlocal Discovery (3km Radius)
The following APIs **automatically** filter results based on the location set in Step 2.

### **Discovery Endpoints:**
- `GET /api/v1/meals`
- `GET /api/v1/chefs`
- `GET /api/v1/subscriptions/plans`
- `GET /api/v1/social`
- `GET /api/v1/pantry`
- `GET /api/v1/feed`

**How to call them:**
Simply call `GET /api/v1/meals`. You **do not** need to send coordinates in the URL. The backend already knows the user's "Active Spot" from the session.

---

## 5. User-Chef Profile Synchronization
For chefs, the location is **automatically synchronized**.
- When a chef calls `PATCH /users/location` (as a user), the backend **instantly** updates their **Professional Kitchen Location** in the Chef table.
- This ensures the chef's meals are always visible to customers within 3km of their current active spot.

---

## 6. Implementation Summary Table
| Goal | API Endpoint | Method | Key Payload Fields |
| :--- | :--- | :--- | :--- |
| **Login** | `/auth/verify-otp` | `POST` | `isChef`, `token`, `latitude` |
| **Set Active Spot** | `/users/location` | `PATCH` | `latitude`, `longitude` |
| **Add to Address Book** | `/users/addresses` | `POST` | `label`, `address_line`, `latitude`, `longitude` |
| **List Meals** | `/meals` | `GET` | (None required - automatic filtering) |
| **List Chefs** | `/chefs` | `GET` | (None required - automatic filtering) |
