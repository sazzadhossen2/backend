# Service Booking API (v2)

REST API for the **Service Booking & Management** mobile app. Customers browse services, book slots, pay online and review; **admins** handle requests and see monthly statistics.

**Stack:** Node.js 20+ · Express 4 · MongoDB (Mongoose) · JWT · bcrypt · Zod · Nodemailer + otp-generator · Stripe · Google Gemini (optional).

## Roles
| Customer (`user`) | Admin (`admin`) |
|---|---|
| Register with **email OTP**, login, reset password by OTP | Same login, the app opens the **admin panel** |
| Browse/search services, see reviews | Dashboard: bookings, completed, reviews and revenue **per month** |
| Book a slot, pay with Stripe, cancel while **pending** (paid = auto refund) | **Confirm / deny / complete** every request (denial reason is emailed) |
| Review a service after it is **completed** | Mark time as **busy** (all services or one) |
| AI assistant, profile | Create / edit / hide services |

## Booking life-cycle
`pending` → admin **confirms** → `confirmed` → admin marks **completed** (or it auto-completes after the end time) → customer can **review**.
Admin can **deny** (`cancelled` + reason) any pending/confirmed booking. Pending bookings nobody handled before their time are auto-cancelled (and refunded).

## Email OTP (Nodemailer + otp-generator)
- `POST /auth/register` creates an *unverified* account and emails a 6-digit code. No token is issued yet.
- `POST /auth/verify-otp` confirms the code and starts the session. `POST /auth/resend-otp` sends another (60 s cooldown).
- Login of an unverified account returns `403` with `code: "EMAIL_NOT_VERIFIED"` and sends a fresh code.
- `POST /auth/forgot-password` + `POST /auth/reset-password` use the same mechanism.
- Safety: codes are random, stored only as an HMAC, single use, expire in 10 minutes, 5 wrong attempts lock the code, endpoints are rate limited, and responses do not reveal whether an email exists.

## Stripe payments
`POST /payments/intent` (server creates the PaymentIntent, amount computed from the stored price, never from the client) → the app shows Stripe's PaymentSheet → `POST /payments/confirm` (server re-checks the intent with Stripe) . Optional webhook: `POST /payments/webhook`.
Prices are in BDT; they are converted with `BDT_PER_CURRENCY_UNIT` into `PAYMENT_CURRENCY` (default USD) because Stripe cannot charge BDT for most accounts. **Use test keys for development/demo.**

## Quick start

```bash
npm install
cp .env.example .env        # then edit MONGO_URI, JWT_SECRET, SMTP_PASS, STRIPE_* (see comments inside)
npm run seed                # sample services + demo/admin accounts
npm run dev                 # http://localhost:5000
```

Health check: `GET http://localhost:5000/api/v1/health`

Seeded accounts

| Role  | Email                 | Password      |
|-------|-----------------------|---------------|
| User  | demo@kiculagbe.com    | Demo@12345    |
| User  | sara@kiculagbe.com    | Sara@12345    |
| Admin | admin@kiculagbe.com   | Admin@12345   |

Demo data: 12 services in 7 categories (4 featured) and 8 bookings. The demo user has upcoming (pending + confirmed), completed and cancelled bookings, so every status is visible in the app right away. Sara's bookings occupy some slots, so the booking screen shows "booked" times. Booking dates are relative to the day you run the seed, so run `npm run seed` again to refresh them.

`npm run seed:fresh` also wipes appointments and services before seeding.

## Demo tip: see every feature
Log in as **admin** in the same mobile app: it opens the admin panel (Dashboard · Requests · Busy · Services). Log in as `demo@kiculagbe.com` to see the customer side. The seed also creates older completed bookings with reviews, so the monthly dashboard has data from the start. Seeded accounts skip the OTP step; new registrations need a real code (in development without SMTP the code is printed in the server console).

## Environment variables

| Name | Description | Default |
|------|-------------|---------|
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string (**required**) | – |
| `JWT_SECRET` | Secret used to sign tokens (**required**) | – |
| `JWT_EXPIRES_IN` | Token lifetime | `7d` |
| `CORS_ORIGINS` | Comma separated origins or `*` | `*` |
| `BUSINESS_OPEN` / `BUSINESS_CLOSE` | Booking hours (HH:mm) | `09:00` / `18:00` |
| `SLOT_MINUTES` | Slot grid size | `30` |
| `BUSINESS_TZ_OFFSET_MIN` | Business time zone offset from UTC (Bangladesh = 360) | `360` |
| `MAX_ADVANCE_DAYS` | How far ahead users can book | `30` |
| `SMTP_USER` / `SMTP_PASS` | Gmail address + **app password** used by Nodemailer | empty |
| `OTP_TTL_MINUTES` / `OTP_MAX_ATTEMPTS` / `OTP_RESEND_COOLDOWN_SECONDS` | OTP rules | `10` / `5` / `60` |
| `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` | Stripe (use test keys while developing) | empty |
| `PAYMENT_CURRENCY` / `BDT_PER_CURRENCY_UNIT` | Charge currency and BDT conversion rate | `usd` / `120` |
| `GEMINI_API_KEY` | Enables the Gemini-powered assistant (optional) | empty |
| `GEMINI_MODEL` | Gemini model id. Change it if Google retires the default | `gemini-2.5-flash` |

## Project structure

```
app.js / index.js         Express app and server bootstrap
src/config/               env config, database connection
src/models/               User, Service, Appointment (Mongoose)
src/controllers/          auth, user, service, appointment, ai
src/routes/api.js         all routes (/api/v1)
src/middlewares/          auth (JWT + roles), validate (Zod), error, rate limiters
src/services/             availability (slots + conflicts), ai (Gemini + fallback)
src/docs/openapi.js       OpenAPI 3 spec used by Swagger UI
src/utils/                ApiError, asyncHandler, response helpers, validators, token
src/seeds/seed.js         sample data
docs/                     API.md, DATABASE.md
```

## How booking conflicts are prevented
1. `GET /services/:id/availability?date=` returns every slot of the day with `available: true|false` (past and booked slots are unavailable).
2. `POST /appointments` re-validates the slot (inside business hours, on the slot grid, in the future, within the booking window).
3. Rejects the request with **409** if an active booking of the same service overlaps, or if the user already has an overlapping booking.
4. A partial unique index `{service, startAt}` (where `isActive = true`) stops two simultaneous requests from taking the same slot.

Booking status flow: `pending → confirmed → completed`, or `pending/confirmed → cancelled`. Users can cancel **pending** bookings only. Admins handle bookings with `PATCH /admin/appointments/:id/status`. Confirmed bookings are marked `completed` automatically once their end time passes.

## Deployment (Render example)
- Build command `npm install`, start command `npm start`
- Set the environment variables above (use MongoDB Atlas for `MONGO_URI`)
- Run `npm run seed` once (Render shell or locally against the Atlas URI)

## Swagger (interactive API docs)
After `npm install` and `npm run dev`, open **http://localhost:5000/api-docs**.
1. Run `POST /auth/login` with the demo account and copy `data.token`.
2. Click **Authorize** (top right), paste the token and confirm.
3. Every endpoint can now be tried with **Try it out**.

The raw spec is at `/api-docs.json` and in `docs/openapi.json` (import it into Postman, Insomnia or https://editor.swagger.io).

## Documentation
- Swagger UI: `/api-docs`
- [OpenAPI file](docs/openapi.json)
- [API reference](docs/API.md)
- [Database design & ER diagram](docs/DATABASE.md)
