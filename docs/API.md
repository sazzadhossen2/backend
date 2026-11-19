# API reference

Base URL: `http://localhost:5000/api/v1`

All responses use one envelope.

```json
{ "success": true,  "message": "Success", "data": { } }
{ "success": false, "message": "Validation failed", "errors": [ { "field": "email", "message": "Enter a valid email address" } ] }
```

Protected routes need `Authorization: Bearer <token>`.

| Status | Meaning |
|--------|---------|
| 200 / 201 | Success / created |
| 400 | Bad request (invalid date, rule violated) |
| 401 | Missing, invalid or expired token, or wrong credentials |
| 403 | Not allowed (admin only) |
| 404 | Not found |
| 409 | Conflict (email exists, slot already booked) |
| 422 | Validation failed |
| 429 | Rate limit reached |

---

## Auth

### POST `/auth/register`
```json
{ "name": "Rahim Uddin", "email": "rahim@example.com", "password": "Secret123" }
```
Password: min 8 characters, at least one letter and one number.

`201`
```json
{ "success": true, "message": "Registration successful",
  "data": { "user": { "id": "665f...", "name": "Rahim Uddin", "email": "rahim@example.com", "phone": "", "role": "user" },
            "token": "eyJhbGciOi..." } }
```

### POST `/auth/login`
```json
{ "email": "demo@kiculagbe.com", "password": "Demo@12345" }
```
`200` same shape as register. Wrong credentials: `401 Invalid email or password`.

### POST `/auth/logout` (auth)
`200` `{ "success": true, "message": "Logged out successfully", "data": null }`. The client deletes its token.

---

## Current user

### GET `/users/me` (auth)
`200` `{ "data": { "user": { ... } } }`

### PUT `/users/me` (auth)
```json
{ "name": "Rahim U.", "phone": "+8801700000000" }
```
Both fields optional, at least one required. `200` returns the updated `user`.

### PUT `/users/me/password` (auth)
```json
{ "currentPassword": "Secret123", "newPassword": "NewSecret456" }
```
`200` `"Password changed successfully"`. Wrong current password: `400`.

---

## Services (public)

### GET `/services`
| Query | Description |
|-------|-------------|
| `search` | matches name, description, category |
| `category` | exact category (case-insensitive) |
| `featured` | `true` for featured only |
| `minPrice`, `maxPrice` | price range |
| `sort` | `popular` (default), `price_asc`, `price_desc`, `rating`, `newest` |
| `page`, `limit` | pagination (`limit` max 100, default 50) |

`200`
```json
{ "data": { "items": [ { "id": "665f...", "name": "Full Body Massage", "description": "...", "price": 2500,
  "durationMinutes": 60, "image": "https://...", "category": "Spa & Wellness", "isFeatured": true,
  "rating": 4.9, "bookingsCount": 210 } ], "total": 12, "page": 1, "limit": 50 } }
```

### GET `/services/categories`
`200` `{ "data": { "categories": ["Automotive", "Fitness", "Home Services"] } }`

### GET `/services/:id`
`200` `{ "data": { "service": { ... } } }` · `404` if not found.

### GET `/services/:id/availability?date=YYYY-MM-DD`
`200`
```json
{ "data": { "serviceId": "665f...", "date": "2026-11-18", "durationMinutes": 60,
  "hours": { "open": "09:00", "close": "18:00", "slotMinutes": 30 },
  "slots": [ { "time": "09:00", "startAt": "2026-11-18T03:00:00.000Z", "endAt": "2026-11-18T04:00:00.000Z", "available": true },
             { "time": "09:30", "startAt": "2026-11-18T03:30:00.000Z", "endAt": "2026-11-18T04:30:00.000Z", "available": false } ] } }
```
`400` for a past date, a date beyond the booking window, or a bad format.

---

## Appointments (auth)

### POST `/appointments`
```json
{ "serviceId": "665f...", "startAt": "2026-11-18T03:00:00.000Z", "notes": "Please call before arriving" }
```
`startAt` must be one of the `startAt` values returned by the availability endpoint. `notes` is optional (max 300).

`201`
```json
{ "success": true, "message": "Appointment booked successfully",
  "data": { "appointment": { "id": "6660...", "user": "665e...", "status": "pending",
    "startAt": "2026-11-18T03:00:00.000Z", "endAt": "2026-11-18T04:00:00.000Z", "notes": "", "price": 2500,
    "service": { "id": "665f...", "name": "Full Body Massage" } } } }
```
Errors: `409` slot taken or overlapping booking of your own, `400` invalid slot, `404` unknown service.

### GET `/appointments`
Query: `when=upcoming|past`, `status=pending|confirmed|cancelled|completed`.
`200` `{ "data": { "items": [ ...appointments with populated service ], "total": 3 } }`
Upcoming = pending/confirmed (soonest first). Past = completed/cancelled (latest first).

### GET `/appointments/:id`
`200` `{ "data": { "appointment": { ... } } }` · `404` if it is not yours.

### PATCH `/appointments/:id/cancel`
Only **pending** bookings. `200` returns the appointment with `status: "cancelled"`. Otherwise `400`.

### PATCH `/appointments/:id/status` (admin only)
```json
{ "status": "confirmed" }
```
Allowed transitions: `pending → confirmed | cancelled`, `confirmed → completed | cancelled`.

---

## AI assistant (auth, 15 requests / minute)

### POST `/ai/chat`
```json
{ "message": "I want something relaxing under 3000", "history": [ { "role": "user", "text": "hi" }, { "role": "assistant", "text": "Hello!" } ] }
```
`history` is optional (last 12 turns). `200`
```json
{ "data": { "reply": "I'd suggest Full Body Massage (৳2,500, 60 min)...",
  "suggestions": [ { "id": "665f...", "name": "Full Body Massage", "price": 2500, "durationMinutes": 60, "image": "https://...", "category": "Spa & Wellness" } ],
  "source": "gemini" } }
```
`source` is `gemini` or `fallback`.


---
# v2 endpoints

Errors may carry a machine readable `code` (`EMAIL_NOT_VERIFIED`, `OTP_INVALID`, `OTP_EXPIRED`, `OTP_LOCKED`, `OTP_COOLDOWN`, `SLOT_BUSY`).
Full interactive reference: Swagger UI at `/api-docs`.

## Auth with email OTP
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | `name, email, password` | `201 { email, requiresVerification:true }`, no token yet |
| POST | `/auth/verify-otp` | `email, otp` | `200 { user, token }` |
| POST | `/auth/resend-otp` | `email` | 60 s cooldown |
| POST | `/auth/login` | `email, password` | `403 EMAIL_NOT_VERIFIED` when not verified |
| POST | `/auth/forgot-password` | `email` | always `200` |
| POST | `/auth/reset-password` | `email, otp, newPassword` | |

## Reviews
- `POST /reviews` `{ appointmentId, rating(1-5), comment? }` (completed booking, once)
- `GET /services/:id/reviews?page&limit` (public)

## Payments (Stripe)
- `POST /payments/intent` `{ appointmentId }` → `{ clientSecret, publishableKey, amount, currency }`
- `POST /payments/confirm` `{ appointmentId }` → `{ appointment }` (`paymentStatus: "paid"`)
- `POST /payments/webhook` (Stripe only)

## Admin (`Authorization` of an admin; others get `403`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/appointments?status&date&month&search&page&limit` | all requests + `counts` per status |
| PATCH | `/admin/appointments/:id/status` | `{ status: confirmed\|cancelled\|completed, reason? }` |
| GET | `/admin/stats?month=YYYY-MM` | monthly numbers, 6-month series, top services |
| GET | `/admin/reviews?month` | reviews |
| GET / POST | `/admin/busy` | `{ date, from, to, serviceId?, reason? }` |
| DELETE | `/admin/busy/:id` | |
| GET / POST | `/admin/services` | all services (incl. hidden) / create |
| PUT | `/admin/services/:id` | update, `isActive:false` hides |

Availability slots now include `reason`: `past`, `busy` or `booked` when `available` is `false`.
