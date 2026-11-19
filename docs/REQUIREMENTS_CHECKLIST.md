# Requirement checklist – Backend (v2)

| PDF requirement | Where |
|-----------------|-------|
| **A. Auth** – registration, login | `POST /auth/register`, `POST /auth/login` (`auth.controller.js`) |
| JWT authentication, protected routes | `middlewares/auth.js` (`protect`, `restrictTo`) |
| Password hashing and validation | bcrypt (cost 12) in `models/User.js`, Zod rules in `utils/validators.js` |
| **B. Services** – list, details, search/filter | `GET /services`, `/services/:id`, `/services/categories` (`service.controller.js`) |
| **C. Appointments** – create, list own, details, cancel | `POST/GET /appointments`, `GET /appointments/:id`, `PATCH /appointments/:id/cancel` |
| Availability + conflict prevention | `GET /services/:id/availability`, overlap checks + partial unique index (`availability.service.js`, `Appointment.js`) |
| **D. User** – get / update profile | `GET/PUT /users/me` (+ `PUT /users/me/password`) |
| **E. Database** – Users, Services, Appointments with relations | `src/models/*`, `docs/DATABASE.md` (ER diagram) |
| Validation, relationships, error handling | Zod `validate` middleware, Mongoose schemas, central `error.js` |
| Node.js + Express + MongoDB + JWT + REST | yes |
| **AI** – questions, recommendations, basic answers | `POST /ai/chat` (`ai.controller.js`, `ai.service.js`) |
| API key only on the backend | `GEMINI_API_KEY` read from env on the server; app never sees it; fallback assistant if absent |
| Folder structure, reusable code | `config / controllers / middlewares / models / routes / services / utils` |
| Consistent API responses | `{ success, message, data }` / `{ success:false, message, errors }` |
| Secure handling of sensitive data | helmet, rate limits, mongo-sanitize, hpp, hashed passwords, secrets in `.env` |
| API documentation | Swagger UI at `/api-docs`, `docs/openapi.json`, `docs/API.md` |
| DB schema / ER diagram + setup | `docs/DATABASE.md` |
| README | `README.md` |

## Extras added on top of the PDF
| Extra | Where |
|---|---|
| Email OTP verification + password reset | `otp.service.js`, `mail.service.js`, `auth.controller.js`, `models/Otp.js` |
| Stripe payments + refund on cancel/deny | `payment.service.js`, `payment.controller.js` |
| Separate **admin** role: confirm / deny / complete, busy time, services, monthly stats | `routes/admin.js`, `admin.controller.js`, `models/BusyBlock.js` |
| Reviews + live service rating | `review.controller.js`, `models/Review.js` |

## Suggested Git commit history
```
chore: initialise Express project, config and folder structure
feat(models): User, Service and Appointment schemas with indexes
feat(auth): register, login, JWT middleware, validation
feat(services): list, details, search, filters, categories
feat(appointments): availability, booking with conflict prevention, list, details, cancel
feat(users): profile and password endpoints
feat(ai): AI service assistant with Gemini and fallback
feat(security): helmet, rate limiting, sanitisation, central error handler
chore(seed): sample data
feat(otp): email verification and password reset with Nodemailer
feat(payments): Stripe PaymentIntent, confirmation, refunds
feat(admin): requests, busy time, services, monthly statistics
feat(reviews): ratings for completed bookings
docs: README, API reference, ER diagram
```
